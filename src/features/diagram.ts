import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { Range, StateField, Transaction } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import mermaid from 'mermaid'
import { viewerModeFacet } from '../editor/wysiwyg'

// ---------------------------------------------------------------------------
// Initialise mermaid once
// ---------------------------------------------------------------------------

let mermaidInitialised = false

function ensureMermaidInit(): void {
  if (mermaidInitialised) return
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      themeVariables: {
        // General
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        primaryColor: '#dce6f0',
        primaryTextColor: '#24292f',
        primaryBorderColor: '#8baac4',
        lineColor: '#8baac4',
        secondaryColor: '#e8f0f8',
        tertiaryColor: '#f0f4f8',
        // Notes
        noteBkgColor: '#fff8e1',
        noteTextColor: '#5d4037',
        noteBorderColor: '#e0c97f',
        // Sequence diagram
        actorBkg: '#dce6f0',
        actorBorder: '#8baac4',
        actorTextColor: '#24292f',
        signalColor: '#24292f',
        signalTextColor: '#24292f',
        labelBoxBkgColor: '#dce6f0',
        labelTextColor: '#24292f',
        loopTextColor: '#5a6a7a',
        activationBkgColor: '#e8f0f8',
        activationBorderColor: '#8baac4',
        sequenceNumberColor: '#fff',
        // Flowchart
        nodeBorder: '#8baac4',
        clusterBkg: '#f0f4f8',
        clusterBorder: '#c8d6e0',
        defaultLinkColor: '#6a8fa8',
        edgeLabelBackground: '#fff',
      },
      flowchart: { useMaxWidth: true, curve: 'basis', padding: 15 },
      sequence: { useMaxWidth: true, mirrorActors: false, messageMargin: 40 },
      gantt: { useMaxWidth: true },
    })
    mermaidInitialised = true
  } catch {
    // mermaid may not be available – degrade gracefully
  }
}

// ---------------------------------------------------------------------------
// Unique id counter for mermaid.render()
// ---------------------------------------------------------------------------

let mermaidIdCounter = 0

function nextMermaidId(): string {
  return `simplemd-mermaid-${++mermaidIdCounter}`
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class DiagramWidget extends WidgetType {
  constructor(readonly code: string) {
    super()
  }

  eq(other: DiagramWidget): boolean {
    return other.code === this.code
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'cm-diagram-container'
    container.textContent = 'Rendering diagram…'

    ensureMermaidInit()

    // mermaid.render is async – render into the container after mount.
    const id = nextMermaidId()
    ;(async () => {
      try {
        const { svg } = await mermaid.render(id, this.code)
        container.innerHTML = svg
      } catch (err) {
        container.style.color = 'red'
        container.textContent = `Diagram error: ${(err as Error).message}`
      }
    })()

    return container
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Find mermaid code blocks
// ---------------------------------------------------------------------------

interface DiagramRange {
  from: number // start of the opening ```mermaid
  to: number // end of the closing ```
  code: string // mermaid source between the fences
}

function findDiagramRanges(doc: string): DiagramRange[] {
  const ranges: DiagramRange[] = []
  // Allow optional horizontal whitespace before the closing ``` fence.
  // CodeMirror's indentOnInput can add leading spaces/tabs as the user types,
  // so the closing fence may not be at column 0.
  const re = /^```mermaid[ \t]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(doc)) !== null) {
    ranges.push({
      from: m.index,
      to: m.index + m[0].length,
      code: m[1].trim(),
    })
  }
  return ranges
}

// ---------------------------------------------------------------------------
// Cursor-inside check (line-based for block regions)
// ---------------------------------------------------------------------------

function cursorInsideBlock(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const { state } = view
  const sel = state.selection.main
  const blockFromLine = state.doc.lineAt(from).number
  const blockToLine = state.doc.lineAt(to).number
  const cursorLine = state.doc.lineAt(sel.head).number
  return cursorLine >= blockFromLine && cursorLine <= blockToLine
}

// ---------------------------------------------------------------------------
// Build decorations (pure function – no EditorView needed, only state)
// ---------------------------------------------------------------------------

function buildDiagramDecorations(
  docText: string,
  doc: { lineAt(pos: number): { number: number } },
  selHead: number,
  viewerMode = false,
): DecorationSet {
  const diagrams = findDiagramRanges(docText)
  const decorations: Range<Decoration>[] = []

  const cursorLine = doc.lineAt(selHead).number

  for (const d of diagrams) {
    if (!viewerMode) {
      const blockFromLine = doc.lineAt(d.from).number
      const blockToLine = doc.lineAt(d.to).number
      if (cursorLine >= blockFromLine && cursorLine <= blockToLine) continue
    }

    decorations.push(
      Decoration.replace({
        widget: new DiagramWidget(d.code),
        block: true,
      }).range(d.from, d.to),
    )
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// StateField (block decorations must be provided via StateField, not ViewPlugin)
// ---------------------------------------------------------------------------

const diagramField = StateField.define<DecorationSet>({
  create(state) {
    const docText = state.doc.toString()
    return buildDiagramDecorations(docText, state.doc, state.selection.main.head, state.facet(viewerModeFacet))
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection || tr.reconfigured) {
      const state = tr.state
      return buildDiagramDecorations(state.doc.toString(), state.doc, state.selection.main.head, state.facet(viewerModeFacet))
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

const diagramBaseTheme = EditorView.baseTheme({
  '.cm-diagram-container': {
    display: 'block',
    padding: '16px',
    margin: '8px 0',
    textAlign: 'center',
    cursor: 'pointer',
    overflow: 'auto',
    background: '#f8fafb',
    borderRadius: '8px',
    border: '1px solid #e1e8ed',
  },
  '.cm-diagram-container svg': {
    maxWidth: '100%',
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension that renders ```mermaid``` fenced code blocks as
 * SVG diagrams.  Supports flowchart, sequence, gantt, pie, and class
 * diagrams.  When the cursor is inside the code block the raw source is
 * shown; otherwise the rendered diagram is displayed.
 */
export function diagramPlugin(): Extension {
  return [diagramField, diagramBaseTheme]
}
