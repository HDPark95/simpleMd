import { KeyBinding } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/**
 * Wrap the current selection with the given prefix/suffix markers.
 * If nothing is selected, insert the markers and place cursor between them.
 */
function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
  const { state } = view

  const transaction = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    // If already wrapped, unwrap
    const before = state.sliceDoc(
      Math.max(0, range.from - prefix.length),
      range.from,
    )
    const after = state.sliceDoc(range.to, range.to + suffix.length)

    if (before === prefix && after === suffix) {
      return {
        changes: [
          { from: range.from - prefix.length, to: range.from, insert: '' },
          { from: range.to, to: range.to + suffix.length, insert: '' },
        ],
        range: EditorSelection.range(
          range.from - prefix.length,
          range.to - prefix.length,
        ),
      }
    }

    // Wrap selection
    const insert = prefix + selected + suffix
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(
        range.from + prefix.length,
        range.from + prefix.length + selected.length,
      ),
    }
  })

  view.dispatch(transaction)
  return true
}

/**
 * Insert a heading prefix at the start of the current line.
 * If the line already has a heading of the same level, remove it.
 */
function insertHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const prefix = '#'.repeat(level) + ' '

  const transaction = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head)
    const lineText = line.text

    // Check if line already starts with a heading
    const headingMatch = lineText.match(/^(#{1,6})\s/)

    if (headingMatch) {
      const existingLevel = headingMatch[1].length
      if (existingLevel === level) {
        // Remove heading
        return {
          changes: { from: line.from, to: line.from + headingMatch[0].length, insert: '' },
          range: EditorSelection.cursor(
            range.head - headingMatch[0].length,
          ),
        }
      }
      // Replace with new level
      return {
        changes: {
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: prefix,
        },
        range: EditorSelection.cursor(
          range.head - headingMatch[0].length + prefix.length,
        ),
      }
    }

    // Insert heading prefix
    return {
      changes: { from: line.from, insert: prefix },
      range: EditorSelection.cursor(range.head + prefix.length),
    }
  })

  view.dispatch(transaction)
  return true
}

/**
 * Insert a link template. If text is selected, use it as the link text.
 */
function insertLink(view: EditorView): boolean {
  const { state } = view

  const transaction = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to)

    if (selected) {
      const insert = `[${selected}](url)`
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(
          range.from + selected.length + 3,
          range.from + selected.length + 6,
        ),
      }
    }

    const insert = '[link text](url)'
    return {
      changes: { from: range.from, insert },
      range: EditorSelection.range(range.from + 1, range.from + 10),
    }
  })

  view.dispatch(transaction)
  return true
}

/**
 * Indent or dedent the current line(s) in list context.
 */
function indentList(view: EditorView, dedent: boolean): boolean {
  const { state } = view
  const indent = '  '

  const transaction = state.changeByRange((range) => {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)
    const changes: { from: number; to: number; insert: string }[] = []
    let offset = 0

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum)
      const listMatch = line.text.match(/^(\s*)([-*+]|\d+\.|>)\s/)

      if (!listMatch) continue

      if (dedent) {
        // Remove up to 2 spaces of leading whitespace
        const leadingSpaces = line.text.match(/^( {1,2})/)
        if (leadingSpaces) {
          changes.push({
            from: line.from,
            to: line.from + leadingSpaces[1].length,
            insert: '',
          })
          offset -= leadingSpaces[1].length
        }
      } else {
        changes.push({ from: line.from, to: line.from, insert: indent })
        offset += indent.length
      }
    }

    if (changes.length === 0) return { range }

    return {
      changes,
      range: EditorSelection.range(
        range.from + (dedent ? Math.min(0, offset) : indent.length),
        range.to + offset,
      ),
    }
  })

  if (transaction.changes.empty) return false

  view.dispatch(transaction)
  return true
}

/**
 * Smart list continuation: when pressing Enter on a list line,
 * auto-insert the appropriate list prefix on the next line.
 */
function smartListContinuation(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main

  // Only handle single cursor, not selection
  if (!range.empty) return false

  const line = state.doc.lineAt(range.head)
  const lineText = line.text

  // Match list patterns: "  - ", "  * ", "  + ", "  1. ", "  - [ ] ", "  - [x] "
  const listMatch = lineText.match(
    /^(\s*)([-*+]|\d+\.)\s(\[[ x]\]\s)?(.*)$/,
  )

  if (!listMatch) return false

  const [, indent, marker, checkbox, content] = listMatch

  // If the line is an empty list item (just the marker), remove it
  if (!content || content.trim() === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: EditorSelection.cursor(line.from),
    })
    return true
  }

  // Determine the next marker
  let nextMarker = marker
  const numMatch = marker.match(/^(\d+)\./)
  if (numMatch) {
    nextMarker = `${parseInt(numMatch[1], 10) + 1}.`
  }

  const checkboxPart = checkbox ? '[ ] ' : ''
  const insert = `\n${indent}${nextMarker} ${checkboxPart}`

  view.dispatch({
    changes: { from: range.head, insert },
    selection: EditorSelection.cursor(range.head + insert.length),
  })
  return true
}

/**
 * Custom keybindings for markdown formatting.
 */
export const markdownKeymap: KeyBinding[] = [
  {
    key: 'Mod-b',
    run: (view) => wrapSelection(view, '**', '**'),
  },
  {
    key: 'Mod-i',
    run: (view) => wrapSelection(view, '*', '*'),
  },
  {
    key: 'Mod-Shift-x',
    run: (view) => wrapSelection(view, '~~', '~~'),
  },
  {
    key: 'Mod-`',
    run: (view) => wrapSelection(view, '`', '`'),
  },
  {
    key: 'Mod-k',
    run: (view) => insertLink(view),
  },
  {
    key: 'Mod-1',
    run: (view) => insertHeading(view, 1),
  },
  {
    key: 'Mod-2',
    run: (view) => insertHeading(view, 2),
  },
  {
    key: 'Mod-3',
    run: (view) => insertHeading(view, 3),
  },
  {
    key: 'Tab',
    run: (view) => indentList(view, false),
  },
  {
    key: 'Shift-Tab',
    run: (view) => indentList(view, true),
  },
  {
    key: 'Enter',
    run: (view) => smartListContinuation(view),
  },
]
