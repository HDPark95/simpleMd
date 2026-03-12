import katex from 'katex'
import mermaid from 'mermaid'

// ---------------------------------------------------------------------------
// Simple markdown-to-HTML conversion
// ---------------------------------------------------------------------------

/**
 * Minimal markdown-to-HTML converter.  For a production editor you would use
 * a full parser (e.g. markdown-it), but this keeps the module self-contained.
 */
function markdownToHTML(md: string): string {
  let html = md

  // Fenced code blocks (must run before inline code)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) =>
      `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`,
  )

  // Block math $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    try {
      return `<div class="math-block">${katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `<div class="math-block math-error">${escapeHtml(latex.trim())}</div>`
    }
  })

  // Inline math $...$
  html = html.replace(
    /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g,
    (_match, latex: string) => {
      try {
        return katex.renderToString(latex.trim(), {
          displayMode: false,
          throwOnError: false,
        })
      } catch {
        return `<span class="math-error">${escapeHtml(latex.trim())}</span>`
      }
    },
  )

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr/>')

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" />',
  )

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  )

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')

  // Unordered lists (simple single-level)
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Tables
  html = convertTables(html)

  // Paragraphs: wrap remaining bare lines
  html = html.replace(
    /^(?!<[a-z/])(.*\S.*)$/gm,
    '<p>$1</p>',
  )

  // Clean up double paragraph wraps
  html = html.replace(/<p><(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)/g, '<$1')
  html = html.replace(/<\/(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)><\/p>/g, '</$1>')

  return html
}

function convertTables(html: string): string {
  const lines = html.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    if (/^\|.+\|$/.test(lines[i].trim())) {
      // Collect all consecutive table rows
      const tableLines: string[] = []
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i].trim())
        i++
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())

        let tableHTML = '<table><thead><tr>'
        for (const cell of headerCells) {
          tableHTML += `<th>${cell}</th>`
        }
        tableHTML += '</tr></thead><tbody>'

        // Skip separator row (index 1)
        for (let r = 2; r < tableLines.length; r++) {
          const cells = tableLines[r]
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((c) => c.trim())
          tableHTML += '<tr>'
          for (const cell of cells) {
            tableHTML += `<td>${cell}</td>`
          }
          tableHTML += '</tr>'
        }

        tableHTML += '</tbody></table>'
        result.push(tableHTML)
      } else {
        result.push(...tableLines)
      }
    } else {
      result.push(lines[i])
      i++
    }
  }

  return result.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Mermaid rendering for export
// ---------------------------------------------------------------------------

let mermaidInitialised = false

async function renderMermaidBlocks(html: string): Promise<string> {
  // Find all mermaid code blocks that survived as <pre><code class="language-mermaid">
  const mermaidRe =
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g

  if (!mermaidInitialised) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      })
      mermaidInitialised = true
    } catch {
      return html // mermaid not available, leave code blocks as-is
    }
  }

  let idCounter = 0
  const replacements: Array<{ original: string; svg: string }> = []

  let match: RegExpExecArray | null
  while ((match = mermaidRe.exec(html)) !== null) {
    const code = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')

    try {
      const { svg } = await mermaid.render(
        `export-mermaid-${++idCounter}`,
        code,
      )
      replacements.push({ original: match[0], svg: `<div class="mermaid-diagram">${svg}</div>` })
    } catch {
      // leave the code block as-is on error
    }
  }

  let result = html
  for (const r of replacements) {
    result = result.replace(r.original, r.svg)
  }

  return result
}

// ---------------------------------------------------------------------------
// Default styles embedded in the exported HTML
// ---------------------------------------------------------------------------

const DEFAULT_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
    line-height: 1.7;
    color: #333;
    background: #fff;
  }
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  code {
    background: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  }
  pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
  }
  blockquote {
    border-left: 4px solid #dfe2e5;
    margin: 0;
    padding: 0.5em 1em;
    color: #6a737d;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  th, td {
    border: 1px solid #dfe2e5;
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background: #f6f8fa;
    font-weight: 600;
  }
  img {
    max-width: 100%;
  }
  hr {
    border: none;
    border-top: 1px solid #eee;
    margin: 2em 0;
  }
  a {
    color: #0366d6;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .math-block {
    text-align: center;
    padding: 8px 0;
    overflow-x: auto;
  }
  .math-error {
    color: red;
  }
  .mermaid-diagram {
    text-align: center;
    padding: 12px 0;
  }
  .mermaid-diagram svg {
    max-width: 100%;
  }
  del {
    text-decoration: line-through;
    color: #999;
  }
`

// KaTeX CSS CDN link (self-contained fallback)
const KATEX_CSS_CDN =
  'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert markdown content to a full self-contained HTML document.
 * Includes inline styles, KaTeX CSS, and renders mermaid diagrams as SVG.
 */
export async function exportToHTML(
  markdown: string,
  title: string,
): Promise<string> {
  let bodyHTML = markdownToHTML(markdown)

  // Render mermaid blocks to SVG
  try {
    bodyHTML = await renderMermaidBlocks(bodyHTML)
  } catch {
    // If mermaid fails, the code blocks remain as <pre><code>
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${KATEX_CSS_CDN}" crossorigin="anonymous">
  <style>${DEFAULT_STYLES}</style>
</head>
<body>
${bodyHTML}
</body>
</html>`
}

/**
 * Synchronous convenience wrapper that returns the HTML string.
 * Mermaid diagrams will be left as code blocks (since mermaid.render is async).
 * For full rendering, use the async `exportToHTML()` instead.
 */
export function getExportHTML(content: string, title: string): string {
  const bodyHTML = markdownToHTML(content)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${KATEX_CSS_CDN}" crossorigin="anonymous">
  <style>${DEFAULT_STYLES}</style>
</head>
<body>
${bodyHTML}
</body>
</html>`
}
