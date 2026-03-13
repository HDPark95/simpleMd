/**
 * Markdown rendering utilities for SimpleMD.
 * A self-contained parser that converts markdown text to HTML
 * with support for GFM extensions.
 */

import hljs from 'highlight.js/lib/core'

export interface Heading {
  level: number
  text: string
  line: number
}

export interface WordCount {
  words: number
  chars: number
  lines: number
  readingTime: number
}

/**
 * Extract headings from markdown text for the outline panel.
 */
export function extractHeadings(text: string): Heading[] {
  const headings: Heading[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/)
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*_`~\[\]]/g, ''),
        line: i + 1,
      })
    }
  }

  return headings
}

/**
 * Count words, characters, lines, and estimated reading time.
 * Reading time based on average 200 words per minute.
 */
export function countWords(text: string): WordCount {
  const lines = text.split('\n').length
  const chars = text.length
  const trimmed = text.trim()
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length
  const readingTime = Math.max(1, Math.ceil(words / 200))

  return { words, chars, lines, readingTime }
}

// --- Markdown-to-HTML converter ---

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Process inline markdown elements: bold, italic, strikethrough,
 * inline code, links, images, footnote references.
 */
function processInline(text: string): string {
  let result = escapeHtml(text)

  // Images: ![alt](src "title")
  result = result.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, alt, src, title) => {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<img src="${src}" alt="${alt}"${titleAttr} />`
    },
  )

  // Links: [text](url "title")
  result = result.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_, linkText, href, title) => {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<a href="${href}"${titleAttr}>${linkText}</a>`
    },
  )

  // Footnote references: [^id]
  result = result.replace(
    /\[\^([^\]]+)\]/g,
    '<sup class="footnote-ref"><a href="#fn-$1" id="fnref-$1">$1</a></sup>',
  )

  // Bold+Italic: ***text*** or ___text___
  result = result.replace(
    /\*{3}(.+?)\*{3}/g,
    '<strong><em>$1</em></strong>',
  )
  result = result.replace(
    /_{3}(.+?)_{3}/g,
    '<strong><em>$1</em></strong>',
  )

  // Bold: **text** or __text__
  result = result.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
  result = result.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(
    /(?<!\w)_(.+?)_(?!\w)/g,
    '<em>$1</em>',
  )

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  return result
}

/**
 * Parse a GFM table block (lines array) into HTML.
 */
function parseTable(lines: string[]): string {
  if (lines.length < 2) return ''

  const parseRow = (line: string): string[] => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
  }

  const headers = parseRow(lines[0])
  const alignLine = parseRow(lines[1])

  const aligns: Array<'left' | 'center' | 'right' | ''> = alignLine.map(
    (cell) => {
      const trimmed = cell.replace(/\s/g, '')
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
      if (trimmed.endsWith(':')) return 'right'
      if (trimmed.startsWith(':')) return 'left'
      return ''
    },
  )

  let html = '<table>\n<thead>\n<tr>\n'
  headers.forEach((h, i) => {
    const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''
    html += `<th${align}>${processInline(h)}</th>\n`
  })
  html += '</tr>\n</thead>\n<tbody>\n'

  for (let r = 2; r < lines.length; r++) {
    const cells = parseRow(lines[r])
    html += '<tr>\n'
    cells.forEach((cell, i) => {
      const align = aligns[i] ? ` style="text-align:${aligns[i]}"` : ''
      html += `<td${align}>${processInline(cell)}</td>\n`
    })
    html += '</tr>\n'
  }

  html += '</tbody>\n</table>'
  return html
}

/**
 * Convert a full markdown document to HTML.
 *
 * Supports: headings, bold, italic, strikethrough, links, images,
 * code blocks, inline code, blockquotes, ordered/unordered/task lists,
 * horizontal rules, GFM tables, and footnotes.
 */
export function markdownToHtml(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0

  // Collect footnote definitions for appending at end
  const footnotes: Map<string, string> = new Map()

  // First pass: extract footnote definitions
  const contentLines: string[] = []
  for (const line of lines) {
    const fnMatch = line.match(/^\[\^([^\]]+)\]:\s+(.+)$/)
    if (fnMatch) {
      footnotes.set(fnMatch[1], fnMatch[2])
    } else {
      contentLines.push(line)
    }
  }

  const processLines = contentLines

  while (i < processLines.length) {
    const line = processLines[i]

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code block: ``` or ~~~
    const codeMatch = line.match(/^(`{3,}|~{3,})(\w*)/)
    if (codeMatch) {
      const fence = codeMatch[1]
      const lang = codeMatch[2]
      const codeLines: string[] = []
      i++
      while (i < processLines.length && !processLines[i].startsWith(fence)) {
        codeLines.push(processLines[i])
        i++
      }
      i++ // skip closing fence
      const codeText = codeLines.join('\n')
      let highlighted: string
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(codeText, { language: lang }).value
      } else if (lang) {
        highlighted = hljs.highlightAuto(codeText).value
      } else {
        highlighted = escapeHtml(codeText)
      }
      const langClass = lang ? `language-${lang} hljs` : ''
      const classAttr = langClass ? ` class="${langClass}"` : ''
      output.push(`<pre><code${classAttr}>${highlighted}</code></pre>`)
      continue
    }

    // Horizontal rule: ---, ***, ___
    if (/^([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line.trim())) {
      output.push('<hr />')
      i++
      continue
    }

    // Heading: # ... ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = processInline(headingMatch[2])
      const id = headingMatch[2]
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
      output.push(`<h${level} id="${id}">${headingText}</h${level}>`)
      i++
      continue
    }

    // Table: starts with | and next line is alignment row
    if (
      line.trim().startsWith('|') &&
      i + 1 < processLines.length &&
      /^\|?[\s:]*-{3,}[\s:]*\|/.test(processLines[i + 1])
    ) {
      const tableLines: string[] = []
      while (
        i < processLines.length &&
        processLines[i].trim().startsWith('|')
      ) {
        tableLines.push(processLines[i])
        i++
      }
      output.push(parseTable(tableLines))
      continue
    }

    // Blockquote: > text
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (
        i < processLines.length &&
        (processLines[i].startsWith('>') || processLines[i].trim() !== '')
      ) {
        if (!processLines[i].startsWith('>')) break
        quoteLines.push(processLines[i].replace(/^>\s?/, ''))
        i++
      }
      const inner = markdownToHtml(quoteLines.join('\n'))
      output.push(`<blockquote>${inner}</blockquote>`)
      continue
    }

    // Unordered list: - , * , +
    const ulMatch = line.match(/^(\s*)([-*+])\s/)
    if (ulMatch) {
      const listItems: string[] = []
      while (i < processLines.length) {
        const li = processLines[i]
        const liMatch = li.match(/^(\s*)([-*+])\s(.*)$/)
        if (!liMatch) break
        const content = liMatch[3]

        // Task list item: - [ ] or - [x]
        const taskMatch = content.match(/^\[( |x)\]\s(.*)$/)
        if (taskMatch) {
          const checked = taskMatch[1] === 'x' ? ' checked' : ''
          listItems.push(
            `<li class="task-list-item"><input type="checkbox"${checked} disabled /> ${processInline(taskMatch[2])}</li>`,
          )
        } else {
          listItems.push(`<li>${processInline(content)}</li>`)
        }
        i++
      }
      const hasTask = listItems.some((li) => li.includes('task-list-item'))
      const cls = hasTask ? ' class="task-list"' : ''
      output.push(`<ul${cls}>\n${listItems.join('\n')}\n</ul>`)
      continue
    }

    // Ordered list: 1. text
    const olMatch = line.match(/^(\s*)(\d+)\.\s/)
    if (olMatch) {
      const listItems: string[] = []
      const startNum = parseInt(olMatch[2], 10)
      while (i < processLines.length) {
        const li = processLines[i]
        const liMatch = li.match(/^(\s*)(\d+)\.\s(.*)$/)
        if (!liMatch) break
        const content = liMatch[3]

        // Ordered task list: 1. [ ] or 1. [x]
        const taskMatch = content.match(/^\[( |x)\]\s(.*)$/)
        if (taskMatch) {
          const checked = taskMatch[1] === 'x' ? ' checked' : ''
          listItems.push(
            `<li class="task-list-item"><input type="checkbox"${checked} disabled /> ${processInline(taskMatch[2])}</li>`,
          )
        } else {
          listItems.push(`<li>${processInline(content)}</li>`)
        }
        i++
      }
      const startAttr = startNum !== 1 ? ` start="${startNum}"` : ''
      output.push(`<ol${startAttr}>\n${listItems.join('\n')}\n</ol>`)
      continue
    }

    // Paragraph: everything else
    const paraLines: string[] = [line]
    i++
    while (
      i < processLines.length &&
      processLines[i].trim() !== '' &&
      !processLines[i].match(/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```|~~~|---|\*\*\*|___|^\|)/)
    ) {
      paraLines.push(processLines[i])
      i++
    }
    output.push(`<p>${processInline(paraLines.join('\n'))}</p>`)
  }

  // Append footnotes section if any
  if (footnotes.size > 0) {
    output.push('<section class="footnotes"><hr /><ol>')
    footnotes.forEach((text, id) => {
      output.push(
        `<li id="fn-${id}"><p>${processInline(text)} <a href="#fnref-${id}" class="footnote-backref">↩</a></p></li>`,
      )
    })
    output.push('</ol></section>')
  }

  return output.join('\n')
}
