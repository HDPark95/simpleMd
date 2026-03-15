/**
 * WYSIWYG-style decorations for CodeMirror 6.
 *
 * This ViewPlugin renders markdown inline, hiding syntax characters
 * when the cursor is not on the affected line, and showing rendered
 * previews (checkboxes, images, horizontal rules, styled headings, links).
 *
 * When the cursor IS on a line, raw markdown is shown for editing.
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import { Facet, Range, StateField } from '@codemirror/state'

// ----- Viewer-mode facet -----

/**
 * A Facet that signals whether the editor is in viewer (read-only) mode.
 * When true, all WYSIWYG decorations are always rendered regardless of cursor position.
 */
export const viewerModeFacet = Facet.define<boolean, boolean>({
  combine: (values) => values.some(Boolean),
})

// ----- Widget types -----

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-task-checkbox'
    input.style.cursor = 'pointer'
    input.style.marginRight = '6px'
    input.style.verticalAlign = 'middle'
    input.style.position = 'relative'
    input.style.top = '0px'
    input.style.marginTop = '-2px'

    input.addEventListener('mousedown', (e) => {
      e.preventDefault()
      // Toggle the checkbox character in the document
      const pos = this.pos
      const char = this.checked ? ' ' : 'x'
      view.dispatch({
        changes: { from: pos, to: pos + 1, insert: char },
      })
    })

    return input
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos
  }

  ignoreEvent(): boolean {
    return false
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-widget'
    wrapper.style.padding = '8px 0'

    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.title = this.alt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    img.style.display = 'block'

    img.onerror = () => {
      wrapper.textContent = `[Image not found: ${this.alt}]`
      wrapper.style.color = '#999'
      wrapper.style.fontStyle = 'italic'
    }

    wrapper.appendChild(img)
    return wrapper
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt
  }

  ignoreEvent(): boolean {
    return true
  }
}

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

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.className = 'cm-hr-widget'
    hr.style.border = 'none'
    hr.style.borderTop = '2px solid var(--md-hr-color, #ddd)'
    hr.style.margin = '16px 0'
    return hr
  }

  eq(): boolean {
    return true
  }

  ignoreEvent(): boolean {
    return true
  }
}

class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet-widget'
    // Use different bullet characters based on nesting depth
    if (this.depth === 0) {
      span.textContent = '\u2022' // •
    } else if (this.depth === 1) {
      span.textContent = '\u25e6' // ◦
    } else {
      span.textContent = '\u25aa' // ▪
    }
    return span
  }

  eq(other: BulletWidget): boolean {
    return this.depth === other.depth
  }

  ignoreEvent(): boolean {
    return true
  }
}

// ----- Heading size map -----

const HEADING_STYLES: Record<number, { fontSize: string; fontWeight: string }> = {
  1: { fontSize: '2.2em', fontWeight: '800' },
  2: { fontSize: '1.7em', fontWeight: '700' },
  3: { fontSize: '1.35em', fontWeight: '700' },
  4: { fontSize: '1.15em', fontWeight: '600' },
  5: { fontSize: '1.05em', fontWeight: '600' },
  6: { fontSize: '1em', fontWeight: '600' },
}

// ----- Decoration builder -----

/**
 * Determine which lines contain the cursor(s).
 */
function getCursorLines(view: EditorView): Set<number> {
  const cursorLines = new Set<number>()
  for (const range of view.state.selection.ranges) {
    const fromLine = view.state.doc.lineAt(range.from).number
    const toLine = view.state.doc.lineAt(range.to).number
    for (let l = fromLine; l <= toLine; l++) {
      cursorLines.add(l)
    }
  }
  return cursorLines
}

// ----- Fenced code block helpers -----

interface FencedBlock {
  from: number
  to: number
  language: string
  code: string
}

/**
 * Find all fenced code blocks in the document, excluding ```mermaid blocks
 * (those are handled by the diagram plugin).
 */
function findFencedCodeBlocks(docText: string): FencedBlock[] {
  const blocks: FencedBlock[] = []
  const re = /^```([^\n`]*)\n([\s\S]*?)^```[ \t]*$/gm
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

/**
 * Build decorations for the entire visible range.
 */
function buildDecorations(view: EditorView): DecorationSet {
  // Skip WYSIWYG decorations entirely when viewing diff content
  if (view.dom.classList.contains('cm-diff-active')) {
    return Decoration.set([])
  }

  const decorations: Range<Decoration>[] = []
  const isViewer = view.state.facet(viewerModeFacet)
  // In viewer mode, never show raw markdown – treat every line as non-active.
  const cursorLines = isViewer ? new Set<number>() : getCursorLines(view)
  const doc = view.state.doc

  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos)
      const lineNum = line.number
      const lineText = line.text
      const isActive = cursorLines.has(lineNum)

      if (!isActive) {
        // --- Headings: hide # prefix and apply large styles ---
        const headingMatch = lineText.match(/^(#{1,6})\s/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const style = HEADING_STYLES[level]

          // Hide the "### " prefix
          decorations.push(
            Decoration.replace({}).range(line.from, line.from + headingMatch[0].length),
          )

          // Style the rest of the line
          decorations.push(
            Decoration.line({
              attributes: {
                style: `font-size:${style.fontSize};font-weight:${style.fontWeight};line-height:1.3;text-decoration:none;`,
                class: `cm-heading cm-heading-${level}`,
              },
            }).range(line.from),
          )
        }

        // --- Bold: hide ** markers ---
        const boldRegex = /\*\*(.+?)\*\*/g
        let boldMatch: RegExpExecArray | null
        while ((boldMatch = boldRegex.exec(lineText)) !== null) {
          const start = line.from + boldMatch.index
          // Hide opening **
          decorations.push(
            Decoration.replace({}).range(start, start + 2),
          )
          // Style content
          decorations.push(
            Decoration.mark({ attributes: { style: 'font-weight:700;' } }).range(
              start + 2,
              start + 2 + boldMatch[1].length,
            ),
          )
          // Hide closing **
          decorations.push(
            Decoration.replace({}).range(
              start + 2 + boldMatch[1].length,
              start + 2 + boldMatch[1].length + 2,
            ),
          )
        }

        // --- Italic: hide * markers (but not inside **) ---
        const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
        let italicMatch: RegExpExecArray | null
        while ((italicMatch = italicRegex.exec(lineText)) !== null) {
          const start = line.from + italicMatch.index
          decorations.push(
            Decoration.replace({}).range(start, start + 1),
          )
          decorations.push(
            Decoration.mark({ attributes: { style: 'font-style:italic;' } }).range(
              start + 1,
              start + 1 + italicMatch[1].length,
            ),
          )
          decorations.push(
            Decoration.replace({}).range(
              start + 1 + italicMatch[1].length,
              start + 1 + italicMatch[1].length + 1,
            ),
          )
        }

        // --- Strikethrough: hide ~~ markers ---
        const strikeRegex = /~~(.+?)~~/g
        let strikeMatch: RegExpExecArray | null
        while ((strikeMatch = strikeRegex.exec(lineText)) !== null) {
          const start = line.from + strikeMatch.index
          decorations.push(
            Decoration.replace({}).range(start, start + 2),
          )
          decorations.push(
            Decoration.mark({
              attributes: { style: 'text-decoration:line-through;' },
            }).range(start + 2, start + 2 + strikeMatch[1].length),
          )
          decorations.push(
            Decoration.replace({}).range(
              start + 2 + strikeMatch[1].length,
              start + 2 + strikeMatch[1].length + 2,
            ),
          )
        }

        // --- Inline code: hide ` markers ---
        const codeRegex = /`([^`]+)`/g
        let codeMatch: RegExpExecArray | null
        while ((codeMatch = codeRegex.exec(lineText)) !== null) {
          const start = line.from + codeMatch.index
          decorations.push(
            Decoration.replace({}).range(start, start + 1),
          )
          decorations.push(
            Decoration.mark({
              class: 'cm-inline-code',
              attributes: {
                style:
                  'background:var(--md-code-bg, #f0f0f0);padding:2px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;',
              },
            }).range(start + 1, start + 1 + codeMatch[1].length),
          )
          decorations.push(
            Decoration.replace({}).range(
              start + 1 + codeMatch[1].length,
              start + 1 + codeMatch[1].length + 1,
            ),
          )
        }

        // --- Links: render with clickable style, hide markdown syntax ---
        const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g
        let linkMatch: RegExpExecArray | null
        while ((linkMatch = linkRegex.exec(lineText)) !== null) {
          const fullStart = line.from + linkMatch.index
          const textStart = fullStart + 1
          const textEnd = textStart + linkMatch[1].length
          const fullEnd = fullStart + linkMatch[0].length

          // Hide [
          decorations.push(
            Decoration.replace({}).range(fullStart, textStart),
          )
          // Style link text
          decorations.push(
            Decoration.mark({
              class: 'cm-link',
              attributes: {
                style: 'color:var(--md-link-color, #0366d6);text-decoration:underline;cursor:pointer;',
                title: linkMatch[2],
              },
            }).range(textStart, textEnd),
          )
          // Hide ](url)
          decorations.push(
            Decoration.replace({}).range(textEnd, fullEnd),
          )
        }

        // --- Images: render as actual <img> widget ---
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
        let imgMatch: RegExpExecArray | null
        while ((imgMatch = imgRegex.exec(lineText)) !== null) {
          const start = line.from + imgMatch.index
          const end = start + imgMatch[0].length
          decorations.push(
            Decoration.replace({
              widget: new ImageWidget(imgMatch[2], imgMatch[1]),
            }).range(start, end),
          )
        }

        // --- Unordered lists: hide marker, replace with bullet widget ---
        // Match lines starting with optional spaces then `- `, `* `, or `+ `,
        // but NOT followed by `[ ]` or `[x]` (those are task lists).
        const ulMatch = lineText.match(/^(\s*)([-*+])\s(?!\[[ x]\]\s)/)
        if (ulMatch) {
          const indentLen = ulMatch[1].length
          // Each 2-space (or 4-space) indent counts as one extra depth level.
          const depth = Math.floor(indentLen / 2)
          const markerLen = ulMatch[2].length + 1 // marker char + space
          const markerStart = line.from + indentLen
          const markerEnd = markerStart + markerLen

          // Replace indentation + marker with bullet widget
          decorations.push(
            Decoration.replace({
              widget: new BulletWidget(depth),
            }).range(line.from, markerEnd),
          )

          // Apply padding-left to the line for visual indentation
          const paddingLeft = 20 + depth * 16
          decorations.push(
            Decoration.line({
              attributes: {
                style: `padding-left:${paddingLeft}px;`,
                class: 'cm-list-item cm-ul-item',
              },
            }).range(line.from),
          )
        }

        // --- Ordered lists: style the number and apply indentation ---
        // Match lines starting with optional spaces then `1. `, `2. `, etc.
        const olMatch = lineText.match(/^(\s*)(\d+)\.\s/)
        if (olMatch) {
          const indentLen = olMatch[1].length
          const depth = Math.floor(indentLen / 2)
          const paddingLeft = 20 + depth * 16

          // Apply padding-left and style for the ordered list line
          decorations.push(
            Decoration.line({
              attributes: {
                style: `padding-left:${paddingLeft}px;`,
                class: 'cm-list-item cm-ol-item',
              },
            }).range(line.from),
          )

          // Style the number and dot
          const numberEnd = line.from + olMatch[0].length - 1 // up to and including the space
          decorations.push(
            Decoration.mark({
              class: 'cm-ol-number',
              attributes: { style: 'font-weight:600;' },
            }).range(line.from + indentLen, numberEnd),
          )
        }

        // --- Task lists: render checkboxes ---
        const taskMatch = lineText.match(/^(\s*)([-*+])\s\[( |x)\]\s/)
        if (taskMatch) {
          const checkboxOffset =
            taskMatch[1].length + taskMatch[2].length + 2 // "- ["
          const charPos = line.from + checkboxOffset // position of ' ' or 'x'
          const isChecked = taskMatch[3] === 'x'

          // Hide "- [ ] " or "- [x] " prefix, replace with checkbox widget
          const prefixEnd = line.from + taskMatch[0].length
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(isChecked, charPos),
            }).range(line.from, prefixEnd),
          )

          // If checked, style the text with strikethrough
          if (isChecked && prefixEnd < line.to) {
            decorations.push(
              Decoration.mark({
                attributes: {
                  style: 'text-decoration:line-through;opacity:0.6;',
                },
              }).range(prefixEnd, line.to),
            )
          }
        }

        // --- Horizontal rules ---
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(lineText) && lineText.trim().length >= 3) {
          // Only match if not a heading (setext) or list
          if (!lineText.match(/^(\s*)([-*+])\s\S/)) {
            decorations.push(
              Decoration.replace({
                widget: new HorizontalRuleWidget(),
              }).range(line.from, line.to),
            )
          }
        }

        // --- Blockquotes: hide `> ` prefix and style the line ---
        const blockquoteMatch = lineText.match(/^(\s*)(>\s)/)
        if (blockquoteMatch) {
          const prefixLen = blockquoteMatch[1].length + blockquoteMatch[2].length
          // Hide the leading `> ` (and any leading whitespace)
          decorations.push(
            Decoration.replace({}).range(line.from, line.from + prefixLen),
          )
          // Style the line as a blockquote
          decorations.push(
            Decoration.line({
              attributes: {
                style:
                  'border-left:3px solid var(--blockquote-border, #ddd);padding-left:16px;color:var(--blockquote-fg, #666);font-style:italic;',
                class: 'cm-blockquote',
              },
            }).range(line.from),
          )
        }
      } else {
        // Active line: show raw markdown but still apply subtle line-level styling
        const headingMatch = lineText.match(/^(#{1,6})\s/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const style = HEADING_STYLES[level]
          decorations.push(
            Decoration.line({
              attributes: {
                style: `font-size:${style.fontSize};font-weight:${style.fontWeight};line-height:1.3;text-decoration:none;`,
                class: `cm-heading cm-heading-${level} cm-heading-active`,
              },
            }).range(line.from),
          )
        }

        // Active blockquote line: keep the `>` visible but apply subtle styling
        const blockquoteActiveMatch = lineText.match(/^(\s*)>\s/)
        if (blockquoteActiveMatch) {
          decorations.push(
            Decoration.line({
              attributes: {
                style:
                  'border-left:3px solid var(--blockquote-border, #ddd);padding-left:16px;',
                class: 'cm-blockquote cm-blockquote-active',
              },
            }).range(line.from),
          )
        }
      }

      pos = line.to + 1
    }
  }

  // Sort decorations by from position, then by startSide
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)

  return Decoration.set(decorations, true)
}

// ----- ViewPlugin -----

import { ViewPlugin, ViewUpdate } from '@codemirror/view'

export const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.transactions.some((tr) => tr.reconfigured)
      ) {
        // Preserve scroll position when decorations change due to cursor movement
        // (e.g., clicking on a heading toggles # prefix visibility, shifting content)
        const scrollDOM = update.view.scrollDOM
        const prevScroll = scrollDOM.scrollTop

        this.decorations = buildDecorations(update.view)

        if (update.selectionSet && !update.docChanged) {
          requestAnimationFrame(() => {
            scrollDOM.scrollTop = prevScroll
          })
        }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

// ----- Base theme for WYSIWYG elements -----

export const wysiwygTheme = EditorView.baseTheme({
  '.cm-heading': {
    lineHeight: '1.3',
    textDecoration: 'none',
    color: 'var(--heading-fg, #1a1a1a)',
  },
  '.cm-heading-1': {
    borderBottom: '1px solid var(--border, #e5e5e5)',
    paddingBottom: '4px',
    marginBottom: '2px',
  },
  '.cm-heading-2': {
    borderBottom: '1px solid var(--border, #e5e5e5)',
    paddingBottom: '4px',
    marginBottom: '2px',
  },
  '.cm-task-checkbox': {
    verticalAlign: 'middle',
    position: 'relative',
    top: '0px',
    marginTop: '-2px',
    marginRight: '6px',
    width: '14px',
    height: '14px',
  },
  '.cm-image-widget': {
    padding: '8px 0',
  },
  '.cm-image-widget img': {
    maxWidth: '100%',
    borderRadius: '4px',
  },
  '.cm-inline-code': {
    borderRadius: '3px',
    padding: '2px 4px',
    fontFamily: 'monospace',
  },
  '.cm-link': {
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  '.cm-hr-widget': {
    border: 'none',
    margin: '16px 0',
  },
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
    background: 'var(--md-code-bg, #f6f8fa)',
    border: '1px solid var(--md-code-border, #e1e4e8)',
    borderRadius: '6px',
    padding: '16px',
    overflowX: 'auto',
    margin: '0',
    fontSize: '0.875em',
    lineHeight: '1.45',
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
  '.cm-codeblock-pre code': {
    background: 'none',
    padding: '0',
    whiteSpace: 'pre',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  '.cm-bullet-widget': {
    display: 'inline-block',
    width: '1.2em',
    textAlign: 'center',
    userSelect: 'none',
    color: 'var(--md-list-bullet-color, inherit)',
  },
  '.cm-list-item': {
    listStyleType: 'none',
  },
  '.cm-ol-number': {
    fontWeight: '600',
  },
  '.cm-blockquote': {
    borderLeft: '3px solid var(--blockquote-border, #ddd)',
    paddingLeft: '16px',
    color: 'var(--blockquote-fg, #666)',
    fontStyle: 'italic',
  },
  '.cm-blockquote-active': {
    color: 'inherit',
    fontStyle: 'inherit',
  },
})
