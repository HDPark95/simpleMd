import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { Range, StateField } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import katex from 'katex'
import { viewerModeFacet } from '../editor/wysiwyg'

// ---------------------------------------------------------------------------
// Widget that renders a KaTeX expression
// ---------------------------------------------------------------------------

class MathWidget extends WidgetType {
  constructor(
    readonly latex: string,
    readonly displayMode: boolean,
  ) {
    super()
  }

  eq(other: MathWidget): boolean {
    return other.latex === this.latex && other.displayMode === this.displayMode
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement(this.displayMode ? 'div' : 'span')
    wrapper.className = this.displayMode ? 'cm-math-block' : 'cm-math-inline'
    try {
      wrapper.innerHTML = katex.renderToString(this.latex, {
        displayMode: this.displayMode,
        throwOnError: false,
        output: 'html',
      })
    } catch (err) {
      wrapper.style.color = 'red'
      wrapper.textContent = `Math error: ${(err as Error).message}`
    }
    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Helpers to find math spans in the document
// ---------------------------------------------------------------------------

interface MathRange {
  from: number
  to: number
  latex: string
  displayMode: boolean
}

function findMathRanges(doc: string): MathRange[] {
  const ranges: MathRange[] = []

  // Block math: $$...$$ (may span multiple lines)
  const blockRe = /\$\$([\s\S]+?)\$\$/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(doc)) !== null) {
    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      latex: m[1].trim(),
      displayMode: true,
    })
  }

  // Inline math: $...$ (single line, non-greedy)
  const inlineRe = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g
  while ((m = inlineRe.exec(doc)) !== null) {
    const overlaps = ranges.some(
      (r) => m!.index >= r.from && m!.index < r.to,
    )
    if (overlaps) continue

    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      latex: m[1].trim(),
      displayMode: false,
    })
  }

  return ranges
}

// ---------------------------------------------------------------------------
// Build decorations (pure – no EditorView needed)
// ---------------------------------------------------------------------------

function buildMathDecorations(
  docText: string,
  doc: { lineAt(pos: number): { number: number } },
  selHead: number,
  viewerMode = false,
): DecorationSet {
  const mathRanges = findMathRanges(docText)
  const decorations: Range<Decoration>[] = []
  const cursorLine = doc.lineAt(selHead).number

  for (const mr of mathRanges) {
    if (!viewerMode) {
      if (mr.displayMode) {
        const blockFromLine = doc.lineAt(mr.from).number
        const blockToLine = doc.lineAt(mr.to).number
        if (cursorLine >= blockFromLine && cursorLine <= blockToLine) continue
      } else {
        if (selHead >= mr.from && selHead <= mr.to) continue
      }
    }

    decorations.push(
      Decoration.replace({
        widget: new MathWidget(mr.latex, mr.displayMode),
        block: mr.displayMode,
      }).range(mr.from, mr.to),
    )
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// StateField (block decorations require StateField, not ViewPlugin)
// ---------------------------------------------------------------------------

const mathField = StateField.define<DecorationSet>({
  create(state) {
    return buildMathDecorations(state.doc.toString(), state.doc, state.selection.main.head, state.facet(viewerModeFacet))
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection || tr.reconfigured) {
      const state = tr.state
      return buildMathDecorations(state.doc.toString(), state.doc, state.selection.main.head, state.facet(viewerModeFacet))
    }
    return decos
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

// ---------------------------------------------------------------------------
// Base styles
// ---------------------------------------------------------------------------

const mathBaseTheme = EditorView.baseTheme({
  '.cm-math-inline': {
    display: 'inline',
    cursor: 'pointer',
  },
  '.cm-math-block': {
    display: 'block',
    textAlign: 'center',
    padding: '8px 0',
    cursor: 'pointer',
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function mathPlugin(): Extension {
  return [mathField, mathBaseTheme]
}
