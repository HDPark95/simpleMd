/**
 * Fenced code block rendering for CodeMirror 6.
 *
 * Replaces ```lang ... ``` blocks with styled <pre><code> widgets
 * when the cursor is not inside the block (or in viewer mode).
 * Excludes ```mermaid blocks (handled by diagram plugin).
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { Range, StateField } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { viewerModeFacet } from '../editor/wysiwyg'

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class CodeBlockWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly language: string,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-codeblock-widget'
    wrapper.style.position = 'relative'

    const pre = document.createElement('pre')
    pre.className = 'cm-codeblock-pre'

    const code = document.createElement('code')
    if (this.language) {
      code.className = `language-${this.language}`
    }
    code.textContent = this.code

    // Copy button
    const copyBtn = document.createElement('button')
    copyBtn.className = 'cm-codeblock-copy-btn'
    copyBtn.textContent = 'Copy'
    copyBtn.type = 'button'
    const codeText = this.code
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard.writeText(codeText).then(() => {
        copyBtn.textContent = 'Copied!'
        setTimeout(() => { copyBtn.textContent = 'Copy' }, 1500)
      })
    })

    pre.appendChild(code)
    wrapper.appendChild(pre)
    wrapper.appendChild(copyBtn)
    return wrapper
  }

  eq(other: CodeBlockWidget): boolean {
    return this.code === other.code && this.language === other.language
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Find fenced code blocks (excluding mermaid)
// ---------------------------------------------------------------------------

interface CodeBlockRange {
  from: number
  to: number
  language: string
  code: string
}

function findCodeBlocks(docText: string): CodeBlockRange[] {
  const blocks: CodeBlockRange[] = []
  const re = /^```([^\n`]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(docText)) !== null) {
    const lang = m[1].trim()
    if (lang === 'mermaid') continue // handled by diagramPlugin
    blocks.push({
      from: m.index,
      to: m.index + m[0].length,
      language: lang,
      code: m[2],
    })
  }
  return blocks
}

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildCodeBlockDecorations(
  docText: string,
  doc: { lineAt(pos: number): { number: number } },
  selHead: number,
  viewerMode = false,
): DecorationSet {
  const blocks = findCodeBlocks(docText)
  const decorations: Range<Decoration>[] = []

  const cursorLine = doc.lineAt(selHead).number

  for (const b of blocks) {
    if (!viewerMode) {
      const blockFromLine = doc.lineAt(b.from).number
      const blockToLine = doc.lineAt(b.to).number
      if (cursorLine >= blockFromLine && cursorLine <= blockToLine) continue
    }

    decorations.push(
      Decoration.replace({
        widget: new CodeBlockWidget(b.code, b.language),
        block: true,
      }).range(b.from, b.to),
    )
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// StateField
// ---------------------------------------------------------------------------

const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    const docText = state.doc.toString()
    return buildCodeBlockDecorations(
      docText,
      state.doc,
      state.selection.main.head,
      state.facet(viewerModeFacet),
    )
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection || tr.reconfigured) {
      const state = tr.state
      return buildCodeBlockDecorations(
        state.doc.toString(),
        state.doc,
        state.selection.main.head,
        state.facet(viewerModeFacet),
      )
    }
    return decos
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

// ---------------------------------------------------------------------------
// Base theme
// ---------------------------------------------------------------------------

const codeBlockBaseTheme = EditorView.baseTheme({
  '.cm-codeblock-widget': {
    display: 'block',
    margin: '8px 0',
    position: 'relative',
  },
  '.cm-codeblock-copy-btn': {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '2px 8px',
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    background: 'var(--code-bg, #f6f8fa)',
    color: 'var(--fg-muted, #666)',
    border: '1px solid var(--border, #e1e4e8)',
    borderRadius: '4px',
    cursor: 'pointer',
    opacity: '0.5',
    transition: 'opacity 0.15s ease',
    zIndex: '1',
  },
  '.cm-codeblock-copy-btn:hover': {
    opacity: '1',
  },
  '.cm-codeblock-pre': {
    background: 'var(--code-bg, #f6f8fa)',
    border: '1px solid var(--border, #e1e4e8)',
    borderRadius: '6px',
    padding: '16px',
    overflowX: 'auto',
    margin: '0',
    fontSize: '0.875em',
    lineHeight: '1.45',
    fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
  },
  '.cm-codeblock-pre code': {
    background: 'none',
    padding: '0',
    whiteSpace: 'pre',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function codeBlockPlugin(): Extension {
  return [codeBlockField, codeBlockBaseTheme]
}
