import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { Range } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

// ---------------------------------------------------------------------------
// Heading representation
// ---------------------------------------------------------------------------

interface Heading {
  level: number
  text: string
  lineNumber: number
  offset: number // character offset of the heading line start
}

/**
 * Scan the document for ATX headings (# ... ######).
 */
function extractHeadings(view: EditorView): Heading[] {
  const doc = view.state.doc
  const headings: Heading[] = []
  const headingRe = /^(#{1,6})\s+(.+)$/

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const match = line.text.match(headingRe)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\s*#+\s*$/, '').trim(), // strip trailing #
        lineNumber: i,
        offset: line.from,
      })
    }
  }

  return headings
}

// ---------------------------------------------------------------------------
// Slug generation for anchor links
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// TOC Widget
// ---------------------------------------------------------------------------

class TocWidget extends WidgetType {
  constructor(readonly headings: Heading[]) {
    super()
  }

  eq(other: TocWidget): boolean {
    if (this.headings.length !== other.headings.length) return false
    return this.headings.every(
      (h, i) =>
        h.text === other.headings[i].text &&
        h.level === other.headings[i].level &&
        h.lineNumber === other.headings[i].lineNumber,
    )
  }

  toDOM(): HTMLElement {
    const nav = document.createElement('nav')
    nav.className = 'cm-toc'

    const title = document.createElement('div')
    title.className = 'cm-toc-title'
    title.textContent = 'Table of Contents'
    nav.appendChild(title)

    const list = document.createElement('ul')
    list.className = 'cm-toc-list'

    // Find the minimum heading level to use as base indentation
    const minLevel =
      this.headings.length > 0
        ? Math.min(...this.headings.map((h) => h.level))
        : 1

    for (const heading of this.headings) {
      const li = document.createElement('li')
      li.className = 'cm-toc-item'
      li.style.paddingLeft = `${(heading.level - minLevel) * 16}px`

      const link = document.createElement('a')
      link.className = 'cm-toc-link'
      link.href = `#${slugify(heading.text)}`
      link.textContent = heading.text
      link.dataset.lineNumber = String(heading.lineNumber)

      li.appendChild(link)
      list.appendChild(li)
    }

    nav.appendChild(list)
    return nav
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Find [TOC] markers
// ---------------------------------------------------------------------------

interface TocMarker {
  from: number
  to: number
}

function findTocMarkers(doc: string): TocMarker[] {
  const markers: TocMarker[] = []
  const re = /^\[TOC\]\s*$/gim
  let m: RegExpExecArray | null
  while ((m = re.exec(doc)) !== null) {
    markers.push({
      from: m.index,
      to: m.index + m[0].length,
    })
  }
  return markers
}

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString()
  const tocMarkers = findTocMarkers(doc)
  if (tocMarkers.length === 0) return Decoration.none

  const headings = extractHeadings(view)
  const sel = view.state.selection.main
  const decorations: Range<Decoration>[] = []

  for (const marker of tocMarkers) {
    // If cursor is on the [TOC] line, show raw text
    const markerLine = view.state.doc.lineAt(marker.from).number
    const cursorLine = view.state.doc.lineAt(sel.head).number
    if (cursorLine === markerLine) continue

    const deco = Decoration.replace({
      widget: new TocWidget(headings),
      block: true,
    })
    decorations.push(deco.range(marker.from, marker.to))
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

const tocViewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      click(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement
        if (
          target.classList.contains('cm-toc-link') &&
          target.dataset.lineNumber
        ) {
          event.preventDefault()
          const lineNum = parseInt(target.dataset.lineNumber, 10)
          if (lineNum >= 1 && lineNum <= view.state.doc.lines) {
            const line = view.state.doc.line(lineNum)
            view.dispatch({
              selection: { anchor: line.from },
              effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
            })
            view.focus()
          }
        }
      },
    },
  },
)

// ---------------------------------------------------------------------------
// Base styles
// ---------------------------------------------------------------------------

const tocBaseTheme = EditorView.baseTheme({
  '.cm-toc': {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '8px 0',
    backgroundColor: '#fafafa',
  },
  '.cm-toc-title': {
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '8px',
    color: '#333',
  },
  '.cm-toc-list': {
    listStyle: 'none',
    margin: '0',
    padding: '0',
  },
  '.cm-toc-item': {
    margin: '2px 0',
    lineHeight: '1.6',
  },
  '.cm-toc-link': {
    color: '#0366d6',
    textDecoration: 'none',
    fontSize: '13px',
    cursor: 'pointer',
  },
  '.cm-toc-link:hover': {
    textDecoration: 'underline',
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension that replaces `[TOC]` markers with a rendered,
 * clickable table of contents listing all headings.  The TOC auto-updates
 * when headings change.  When the cursor is on the `[TOC]` line the raw
 * marker is shown.
 */
export function tocPlugin(): Extension {
  return [tocViewPlugin, tocBaseTheme]
}
