/**
 * Main CodeMirror 6 editor setup for SimpleMD.
 *
 * Creates a fully configured markdown editor with:
 * - GFM markdown support with syntax highlighting
 * - WYSIWYG inline rendering
 * - Custom keybindings for markdown formatting
 * - Search/replace
 * - Word/char/line counting
 * - Custom event dispatching for UI integration
 */

import { EditorState, Extension, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder,
  drawSelection,
  highlightActiveLine,
  highlightSpecialChars,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { search, searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search'
import { GFM } from '@lezer/markdown'

import { markdownKeymap } from './keymap'
import { markdownToHtml, extractHeadings, countWords } from './markdown'
import { wysiwygPlugin, wysiwygTheme, viewerModeFacet } from './wysiwyg'
import { diagramPlugin } from '../features/diagram'
import { mathPlugin } from '../features/math'
import { tablePlugin } from '../features/table'
import { codeBlockPlugin } from '../features/codeblock'
import { diffPlugin } from '../features/diff'

// ----- Custom event dispatching -----

function dispatchCustomEvent(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

// ----- Code syntax highlighting theme (vivid, IDE-like) -----

const codeHighlightStyle = HighlightStyle.define([
  // Keywords: SELECT, FROM, WHERE, INSERT, CREATE, etc.
  { tag: t.keyword, color: '#0033b3', fontWeight: 'bold' },
  { tag: t.controlKeyword, color: '#0033b3', fontWeight: 'bold' },
  { tag: t.operatorKeyword, color: '#0033b3', fontWeight: 'bold' },
  { tag: t.definitionKeyword, color: '#0033b3', fontWeight: 'bold' },
  { tag: t.moduleKeyword, color: '#0033b3', fontWeight: 'bold' },

  // Types: INT, VARCHAR, TEXT, etc.
  { tag: t.typeName, color: '#7a3e9d' },
  { tag: t.standard(t.typeName), color: '#7a3e9d' },

  // Functions: NOW(), UUID_TO_BIN(), COUNT(), etc.
  { tag: t.function(t.variableName), color: '#00627a' },
  { tag: t.standard(t.function(t.variableName)), color: '#00627a' },

  // Strings: 'text', "text"
  { tag: t.string, color: '#067d17' },
  { tag: t.special(t.string), color: '#067d17' },

  // Numbers
  { tag: t.number, color: '#1750eb' },
  { tag: t.integer, color: '#1750eb' },
  { tag: t.float, color: '#1750eb' },

  // Variables & identifiers
  { tag: t.variableName, color: '#871094' },
  { tag: t.propertyName, color: '#283593' },
  { tag: t.definition(t.variableName), color: '#871094' },

  // Operators: =, +, -, *, etc.
  { tag: t.operator, color: '#333' },
  { tag: t.compareOperator, color: '#333' },
  { tag: t.arithmeticOperator, color: '#333' },
  { tag: t.logicOperator, color: '#0033b3', fontWeight: 'bold' },

  // Comments — clearly distinct: lighter, italic
  { tag: t.comment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#8c8c8c', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#8c8c8c', fontStyle: 'italic' },

  // Punctuation
  { tag: t.punctuation, color: '#333' },
  { tag: t.paren, color: '#333' },
  { tag: t.squareBracket, color: '#333' },
  { tag: t.brace, color: '#333' },
  { tag: t.separator, color: '#333' },

  // Boolean, null
  { tag: t.bool, color: '#0033b3', fontWeight: 'bold' },
  { tag: t.null, color: '#0033b3', fontWeight: 'bold' },

  // Labels / aliases
  { tag: t.labelName, color: '#283593' },

  // Tags (HTML/XML)
  { tag: t.tagName, color: '#0033b3' },
  { tag: t.attributeName, color: '#174ad4' },
  { tag: t.attributeValue, color: '#067d17' },

  // Regex
  { tag: t.regexp, color: '#264f78' },

  // Meta
  { tag: t.meta, color: '#666' },
])

// ----- Update listener: fires status events on every editor change -----

function statusUpdateListener(): Extension {
  let isModified = false

  return EditorView.updateListener.of((update) => {
    const { state } = update

    // Cursor position
    if (update.selectionSet || update.docChanged) {
      const mainSel = state.selection.main
      const line = state.doc.lineAt(mainSel.head)
      const col = mainSel.head - line.from

      dispatchCustomEvent('editor:cursor', {
        line: line.number,
        col: col + 1,
        selection: mainSel.empty
          ? 0
          : Math.abs(mainSel.to - mainSel.from),
      })
    }

    // Word count
    if (update.docChanged) {
      const text = state.doc.toString()
      const counts = countWords(text)
      dispatchCustomEvent('editor:wordcount', counts)

      // Modified flag
      if (!isModified) {
        isModified = true
        dispatchCustomEvent('editor:modified', { modified: true })
      }

      // Headings for outline panel
      const headings = extractHeadings(text)
      dispatchCustomEvent('editor:headings', { headings })
    }
  })
}

// ----- Editor theme -----

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  '.cm-content': {
    caretColor: 'var(--md-caret-color, #333)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--md-caret-color, #333)',
    borderLeftWidth: '2px',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--md-active-line-bg, rgba(0, 0, 0, 0.03))',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--md-selection-bg, rgba(0, 120, 255, 0.15)) !important',
  },
  '.cm-placeholder': {
    color: 'var(--md-placeholder-color, #aaa)',
    fontStyle: 'italic',
  },
})

// ----- Compartments -----

const readOnlyCompartment = new Compartment()
const viewerModeCompartment = new Compartment()
const languageCompartment = new Compartment()
const markdownPluginsCompartment = new Compartment()
const lineNumbersCompartment = new Compartment()
const editorLayoutCompartment = new Compartment()
const highlightCompartment = new Compartment()

// ----- Language helpers -----

type EditorMode = 'markdown' | 'code'
let currentMode: EditorMode = 'markdown'

function getMarkdownExtensions(): Extension[] {
  return [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [GFM],
    }),
  ]
}

async function getLanguageExtension(ext: string): Promise<Extension[]> {
  const lower = ext.toLowerCase()

  // Direct imports for common languages (more reliable than language-data lookup)
  try {
    switch (lower) {
      case '.sql': {
        const { sql, StandardSQL } = await import('@codemirror/lang-sql')
        return [sql({ dialect: StandardSQL, upperCaseKeywords: true })]
      }
      case '.js': case '.mjs': case '.cjs': case '.jsx': {
        const { javascript } = await import('@codemirror/lang-javascript')
        return [javascript({ jsx: lower === '.jsx' })]
      }
      case '.ts': case '.tsx': {
        const { javascript } = await import('@codemirror/lang-javascript')
        return [javascript({ typescript: true, jsx: lower === '.tsx' })]
      }
      case '.json': {
        const { json } = await import('@codemirror/lang-json')
        return [json()]
      }
      case '.html': case '.htm': {
        const { html } = await import('@codemirror/lang-html')
        return [html()]
      }
      case '.css': case '.scss': case '.less': {
        const { css } = await import('@codemirror/lang-css')
        return [css()]
      }
      case '.py': {
        const { python } = await import('@codemirror/lang-python')
        return [python()]
      }
      case '.xml': case '.svg': {
        const { xml } = await import('@codemirror/lang-xml')
        return [xml()]
      }
      case '.yaml': case '.yml': {
        const { yaml } = await import('@codemirror/lang-yaml')
        return [yaml()]
      }
    }
  } catch {
    // Direct import failed, fall through to language-data lookup
  }

  // Fallback: use @codemirror/language-data
  const extToName: Record<string, string> = {
    '.java': 'Java', '.kt': 'Kotlin', '.go': 'Go', '.rs': 'Rust',
    '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++',
    '.cs': 'C#', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
    '.lua': 'Lua', '.r': 'R', '.scala': 'Scala', '.sh': 'Shell',
    '.bash': 'Shell', '.zsh': 'Shell', '.toml': 'TOML',
  }

  const langName = extToName[lower]
  if (!langName) return []

  const desc = languages.find(l => l.name === langName)
  if (!desc) return []

  const support = await desc.load()
  return [support]
}

function markdownPlugins(): Extension[] {
  return [
    wysiwygPlugin,
    wysiwygTheme,
    diagramPlugin(),
    mathPlugin(),
    tablePlugin(),
    codeBlockPlugin(),
    diffPlugin(),
  ]
}

/** Content styling for markdown mode (centered, no line numbers) */
const markdownLayout = EditorView.theme({
  '.cm-content': {
    padding: '24px 48px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  '.cm-gutters': {
    display: 'none',
  },
})

/** Content styling for code mode (respects app theme, full width, line numbers, monospace) */
const codeLayout = EditorView.theme({
  '.cm-content': {
    padding: '12px 16px',
    maxWidth: 'none',
    margin: '0',
    fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    display: 'flex',
    background: 'var(--sidebar-bg, #f5f5f5)',
    borderRight: '1px solid var(--border, #e0e0e0)',
    color: 'var(--text-muted, #999)',
    fontSize: '13px',
    fontFamily: '"SF Mono", Menlo, Monaco, monospace',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    minWidth: '3em',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--md-active-line-bg, rgba(0,0,0,0.05))',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(0, 120, 255, 0.15)',
    outline: '1px solid rgba(0, 120, 255, 0.3)',
  },
  '.cm-foldGutter .cm-gutterElement': {
    color: 'var(--text-muted, #999)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--border, #e0e0e0)',
    border: 'none',
    color: 'var(--text, #333)',
  },
})

// ----- Extension set -----

function createExtensions(initialReadOnly = false): Extension[] {
  return [
    readOnlyCompartment.of(EditorState.readOnly.of(initialReadOnly)),
    viewerModeCompartment.of(viewerModeFacet.of(initialReadOnly)),

    // Core editing
    history(),
    drawSelection(),
    highlightActiveLine(),
    highlightSpecialChars(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    EditorState.tabSize.of(4),

    // Language (swappable)
    languageCompartment.of(getMarkdownExtensions()),

    // Syntax highlighting (swappable)
    highlightCompartment.of(syntaxHighlighting(defaultHighlightStyle, { fallback: true })),

    // Markdown-only plugins (swappable)
    markdownPluginsCompartment.of(markdownPlugins()),

    // Line numbers (hidden in markdown, shown in code)
    lineNumbersCompartment.of([]),

    // Editor layout (markdown centered vs code full-width)
    editorLayoutCompartment.of(markdownLayout),

    // Placeholder
    placeholder('Start writing...'),

    // Search panel at top
    search({ top: true }),

    // Keymaps
    keymap.of([
      ...markdownKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),

    // Theme
    editorTheme,

    // Status updates
    statusUpdateListener(),
  ]
}

// ----- Public API -----

export interface SimpleMDEditor {
  /** The CodeMirror EditorView instance */
  view: EditorView
  /** Get the current document content as markdown text */
  getContent(): string
  /** Replace the entire document content */
  setContent(text: string): void
  /** Convert the current document to HTML */
  getHTML(): string
  /** Toggle or set the read-only state of the editor */
  setReadOnly(readOnly: boolean): void
  /** Open the search panel */
  openSearch(): void
  /** Switch language mode based on file extension */
  setLanguageForFile(filePath: string | null): Promise<void>
  /** Get the current editor mode */
  getEditorMode(): EditorMode
}

/**
 * Create a new SimpleMD editor instance inside the given parent element.
 * @param initialReadOnly - If true, the editor starts in read-only (viewer) mode.
 */
export function createEditor(parent: HTMLElement, initialReadOnly = false): SimpleMDEditor {
  const state = EditorState.create({
    doc: '',
    extensions: createExtensions(initialReadOnly),
  })

  const view = new EditorView({
    state,
    parent,
  })

  // Fire initial events
  const text = view.state.doc.toString()
  dispatchCustomEvent('editor:wordcount', countWords(text))
  dispatchCustomEvent('editor:headings', { headings: extractHeadings(text) })
  dispatchCustomEvent('editor:cursor', { line: 1, col: 1, selection: 0 })

  return {
    view,

    getContent(): string {
      return view.state.doc.toString()
    },

    setContent(text: string): void {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: text,
        },
      })
      // Reset modified state and fire fresh events
      dispatchCustomEvent('editor:modified', { modified: false })
      dispatchCustomEvent('editor:wordcount', countWords(text))
      dispatchCustomEvent('editor:headings', {
        headings: extractHeadings(text),
      })
    },

    getHTML(): string {
      const text = view.state.doc.toString()
      return markdownToHtml(text)
    },

    setReadOnly(readOnly: boolean): void {
      view.dispatch({
        effects: [
          readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
          viewerModeCompartment.reconfigure(viewerModeFacet.of(readOnly)),
        ],
      })
    },

    openSearch(): void {
      openSearchPanel(view)
    },

    async setLanguageForFile(filePath: string | null): Promise<void> {
      const ext = filePath ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '.md'
      const isMd = ext === '.md' || ext === '.markdown' || ext === '.txt' || ext === ''

      if (isMd && currentMode === 'markdown') return
      if (!isMd && currentMode === 'code') {
        // Still code mode, but maybe different language — update language only
        const langExt = await getLanguageExtension(ext)
        view.dispatch({
          effects: [
            languageCompartment.reconfigure(langExt.length ? langExt : []),
          ],
        })
        return
      }

      if (isMd) {
        currentMode = 'markdown'
        view.dispatch({
          effects: [
            languageCompartment.reconfigure(getMarkdownExtensions()),
            markdownPluginsCompartment.reconfigure(markdownPlugins()),
            lineNumbersCompartment.reconfigure([]),
            editorLayoutCompartment.reconfigure(markdownLayout),
            highlightCompartment.reconfigure(syntaxHighlighting(defaultHighlightStyle, { fallback: true })),
          ],
        })
      } else {
        currentMode = 'code'
        const langExt = await getLanguageExtension(ext)
        view.dispatch({
          effects: [
            languageCompartment.reconfigure(langExt.length ? langExt : []),
            markdownPluginsCompartment.reconfigure([]),
            lineNumbersCompartment.reconfigure([lineNumbers(), foldGutter()]),
            editorLayoutCompartment.reconfigure(codeLayout),
            highlightCompartment.reconfigure(syntaxHighlighting(codeHighlightStyle, { fallback: true })),
          ],
        })
      }
    },

    getEditorMode(): EditorMode {
      return currentMode
    },
  }
}
