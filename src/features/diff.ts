/**
 * Git diff viewer plugin for CodeMirror 6.
 * GitHub-style diff rendering with clear visual hierarchy.
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  lineNumbers,
} from '@codemirror/view'
import { Range, StateField } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

// ---------------------------------------------------------------------------
// Detect whether the document looks like diff content
// ---------------------------------------------------------------------------

function isDiffContent(docText: string): boolean {
  if (docText.startsWith('diff --git ')) return true
  if (docText.startsWith('diff ')) return true
  if (docText.startsWith('--- ')) return true
  const firstLines = docText.slice(0, 500).split('\n')
  let hunkCount = 0
  let plusMinusCount = 0
  for (const line of firstLines) {
    if (line.startsWith('@@')) hunkCount++
    if (line.startsWith('+') || line.startsWith('-')) plusMinusCount++
  }
  return hunkCount >= 1 && plusMinusCount >= 2
}

// ---------------------------------------------------------------------------
// Line decoration styles
// ---------------------------------------------------------------------------

const addedLineDeco = Decoration.line({
  attributes: { class: 'cm-diff-added' },
})

const removedLineDeco = Decoration.line({
  attributes: { class: 'cm-diff-removed' },
})

const hunkHeaderDeco = Decoration.line({
  attributes: { class: 'cm-diff-hunk' },
})

const fileHeaderDeco = Decoration.line({
  attributes: { class: 'cm-diff-file-header' },
})

const contextLineDeco = Decoration.line({
  attributes: { class: 'cm-diff-context' },
})

const fileSeparatorDeco = Decoration.line({
  attributes: { class: 'cm-diff-separator' },
})

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildDiffDecorations(docText: string, doc: { line(n: number): { from: number; text: string }; lines: number }): DecorationSet {
  if (!isDiffContent(docText)) {
    return Decoration.set([])
  }

  const decorations: Range<Decoration>[] = []

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text

    if (text.startsWith('diff ')) {
      decorations.push(fileSeparatorDeco.range(line.from))
      decorations.push(fileHeaderDeco.range(line.from))
    } else if (text.startsWith('index ')) {
      decorations.push(fileHeaderDeco.range(line.from))
    } else if (text.startsWith('--- ') || text.startsWith('+++ ')) {
      decorations.push(fileHeaderDeco.range(line.from))
    } else if (text.startsWith('@@')) {
      decorations.push(hunkHeaderDeco.range(line.from))
    } else if (text.startsWith('+')) {
      decorations.push(addedLineDeco.range(line.from))
    } else if (text.startsWith('-')) {
      decorations.push(removedLineDeco.range(line.from))
    } else if (text.startsWith(' ')) {
      decorations.push(contextLineDeco.range(line.from))
    }
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// StateField
// ---------------------------------------------------------------------------

const diffField = StateField.define<DecorationSet>({
  create(state) {
    return buildDiffDecorations(state.doc.toString(), state.doc)
  },
  update(decos, tr) {
    if (tr.docChanged) {
      return buildDiffDecorations(tr.state.doc.toString(), tr.state.doc)
    }
    return decos
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

// ---------------------------------------------------------------------------
// Base theme — GitHub-style diff colors
// ---------------------------------------------------------------------------

const diffBaseTheme = EditorView.baseTheme({
  // Added lines: green
  '.cm-diff-added': {
    backgroundColor: '#dafbe1',
    borderLeft: '3px solid #2da44e',
    paddingLeft: '8px',
  },
  // Removed lines: red
  '.cm-diff-removed': {
    backgroundColor: '#ffebe9',
    borderLeft: '3px solid #cf222e',
    paddingLeft: '8px',
  },
  // Hunk headers: blue banner
  '.cm-diff-hunk': {
    backgroundColor: '#ddf4ff',
    borderLeft: '3px solid #54aeff',
    paddingLeft: '8px',
    color: '#0969da',
    fontWeight: '600',
    fontSize: '12px',
    lineHeight: '2',
  },
  // File headers: strong dark bar
  '.cm-diff-file-header': {
    backgroundColor: '#d8dee4',
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#1f2328',
    paddingLeft: '11px',
    borderLeft: '3px solid #656d76',
  },
  // File separator: thick top border + spacing
  '.cm-diff-separator': {
    borderTop: '4px solid #8b949e',
    marginTop: '16px',
    paddingTop: '8px',
  },
  // Context lines: subtle
  '.cm-diff-context': {
    color: '#57606a',
    paddingLeft: '11px',  // 3px border + 8px padding alignment
  },
  // Active diff mode: monospace, tight line height
  '&.cm-diff-active .cm-content': {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '13px',
    lineHeight: '1.45',
    maxWidth: 'none',
  },
  '&.cm-diff-active .cm-line': {
    padding: '1px 0',
  },
  '&.cm-diff-active .cm-gutters': {
    display: 'flex',
    backgroundColor: '#f6f8fa',
    borderRight: '1px solid #d0d7de',
    color: '#8c959f',
    fontSize: '12px',
  },
  '&.cm-diff-active .cm-scroller': {
    overflow: 'auto',
  },
})

// ---------------------------------------------------------------------------
// Toggle .cm-diff-active class
// ---------------------------------------------------------------------------

const diffActiveClass = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.startState.doc.length === 0) {
    const docText = update.state.doc.toString()
    const active = isDiffContent(docText)
    const editorDom = update.view.dom
    if (active) {
      editorDom.classList.add('cm-diff-active')
    } else {
      editorDom.classList.remove('cm-diff-active')
    }
  }
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function diffPlugin(): Extension {
  return [diffField, diffBaseTheme, diffActiveClass, lineNumbers()]
}
