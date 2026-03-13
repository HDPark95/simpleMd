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
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github.css'

// Register common languages
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import diff from 'highlight.js/lib/languages/diff'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('tsx', typescript)
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('zsh', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('go', go)
hljs.registerLanguage('golang', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('rs', rust)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('cs', csharp)
hljs.registerLanguage('php', php)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rb', ruby)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('kt', kotlin)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('docker', dockerfile)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('patch', diff)
hljs.registerLanguage('jsp', xml)

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
      code.className = `language-${this.language} hljs`
    }
    // Apply syntax highlighting
    if (this.language && hljs.getLanguage(this.language)) {
      const result = hljs.highlight(this.code, { language: this.language })
      console.log('[SimpleMD] hljs highlight:', this.language, 'tokens:', result.value.substring(0, 100))
      code.innerHTML = result.value
    } else if (this.language) {
      // Unknown language — try auto-detect
      const result = hljs.highlightAuto(this.code)
      console.log('[SimpleMD] hljs auto:', result.language, 'tokens:', result.value.substring(0, 100))
      code.innerHTML = result.value
      code.classList.add('hljs')
    } else {
      console.log('[SimpleMD] hljs: no language specified')
      code.textContent = this.code
    }

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
