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
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search'
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
    padding: '24px 48px',
    maxWidth: '800px',
    margin: '0 auto',
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
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-placeholder': {
    color: 'var(--md-placeholder-color, #aaa)',
    fontStyle: 'italic',
  },
})

// ----- Read-only and viewer-mode compartments -----

const readOnlyCompartment = new Compartment()
const viewerModeCompartment = new Compartment()

// ----- Extension set -----

function createExtensions(initialReadOnly = false): Extension[] {
  return [
    readOnlyCompartment.of(EditorState.readOnly.of(initialReadOnly)),
    viewerModeCompartment.of(viewerModeFacet.of(initialReadOnly)),
    // Core editing (readOnly compartment already added above)
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

    // Markdown language with GFM
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      extensions: [GFM],
    }),

    // Syntax highlighting
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Placeholder
    placeholder('Start writing...'),

    // Keymaps (order matters: custom first, then defaults)
    keymap.of([
      ...markdownKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),

    // WYSIWYG rendering
    wysiwygPlugin,
    wysiwygTheme,

    // Feature plugins: diagrams, math, tables, code blocks
    diagramPlugin(),
    mathPlugin(),
    tablePlugin(),
    codeBlockPlugin(),

    // Diff viewer
    diffPlugin(),

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
  }
}
