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
        // Store SVG data for fullscreen handler
        container.dataset.svg = svg

        // Add expand button directly in the widget DOM
        const expandBtn = document.createElement('button')
        expandBtn.className = 'cm-diagram-expand-btn'
        expandBtn.textContent = '⤢'
        expandBtn.title = 'Open fullscreen (or double-click diagram)'
        expandBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          openDiagramFullscreen(svg)
        })
        container.appendChild(expandBtn)
      } catch (err) {
        container.style.color = 'red'
        container.textContent = `Diagram error: ${(err as Error).message}`
      }
    })()

    // Attach dblclick handler directly on widget DOM — this is the most
    // reliable approach because CM6 block widgets don't reliably propagate
    // events to EditorView.domEventHandlers.
    container.addEventListener('dblclick', (e) => {
      if (container.dataset.svg) {
        e.preventDefault()
        e.stopPropagation()
        openDiagramFullscreen(container.dataset.svg)
      }
    })

    return container
  }

  /** Return true so CM6 ignores mouse events on this widget and lets them
   *  reach the DOM handlers we attached in toDOM(). */
  ignoreEvent(): boolean {
    return true
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
// Fullscreen overlay
// ---------------------------------------------------------------------------

function openDiagramFullscreen(svg: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'cm-diagram-fullscreen'

  const closeBtn = document.createElement('button')
  closeBtn.className = 'cm-diagram-fullscreen-close'
  closeBtn.textContent = '✕'
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    close()
  })

  const content = document.createElement('div')
  content.className = 'cm-diagram-fullscreen-content'
  content.innerHTML = svg

  // Remove fixed dimensions from SVG so it scales freely
  const svgEl = content.querySelector('svg')
  if (svgEl) {
    svgEl.removeAttribute('width')
    svgEl.removeAttribute('height')
    svgEl.style.width = '100%'
    svgEl.style.height = 'auto'
    svgEl.style.maxHeight = '80vh'
  }

  overlay.appendChild(closeBtn)
  overlay.appendChild(content)

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onKey)
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)

  document.body.appendChild(overlay)
}

// ---------------------------------------------------------------------------
// Base styles
// ---------------------------------------------------------------------------

const diagramBaseTheme = EditorView.baseTheme({
  '.cm-diagram-container': {
    display: 'block',
    position: 'relative',
    padding: '16px',
    margin: '8px 0',
    textAlign: 'center',
    overflow: 'auto',
    background: '#f8fafb',
    borderRadius: '8px',
    border: '1px solid #e1e8ed',
  },
  '.cm-diagram-container svg': {
    maxWidth: '100%',
  },
  '.cm-diagram-container:hover': {
    borderColor: '#54aeff',
    boxShadow: '0 0 0 1px #54aeff',
  },
})

// Fullscreen styles (appended to document, not CM theme — needs to be outside editor)
const fullscreenStyle = document.createElement('style')
fullscreenStyle.textContent = `
  .cm-diagram-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    animation: diagram-fade-in 0.15s ease;
  }
  @keyframes diagram-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .cm-diagram-fullscreen-content {
    background: white;
    border-radius: 12px;
    padding: 40px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    width: 90vw;
    max-height: 85vh;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cm-diagram-fullscreen-close {
    position: absolute;
    top: 20px;
    right: 24px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.9);
    color: #333;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform 0.1s ease;
  }
  .cm-diagram-fullscreen-close:hover {
    transform: scale(1.1);
    background: white;
  }
  .cm-diagram-expand-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    background: rgba(255,255,255,0.9);
    color: #57606a;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 1;
  }
  .cm-diagram-container:hover .cm-diagram-expand-btn {
    opacity: 1;
  }
  .cm-diagram-expand-btn:hover {
    background: #0969da;
    color: white;
    border-color: #0969da;
  }
`
document.head.appendChild(fullscreenStyle)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension that renders ```mermaid``` fenced code blocks as
 * SVG diagrams.  Supports flowchart, sequence, gantt, pie, and class
 * diagrams.  When the cursor is inside the code block the raw source is
 * shown; otherwise the rendered diagram is displayed.
 */
// CM6 event handler — intercept dblclick on diagrams at the editor level
const diagramDblClickHandler = EditorView.domEventHandlers({
  dblclick(event: MouseEvent) {
    const target = event.target as HTMLElement
    const container = target.closest('.cm-diagram-container') as HTMLElement | null
    if (container && container.dataset.svg) {
      event.preventDefault()
      openDiagramFullscreen(container.dataset.svg)
      return true
    }
    return false
  },
})

export function diagramPlugin(): Extension {
  return [diagramField, diagramBaseTheme, diagramDblClickHandler]
}
