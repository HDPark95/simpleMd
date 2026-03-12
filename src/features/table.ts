import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view'
import { EditorSelection, Range, StateField } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { viewerModeFacet } from '../editor/wysiwyg'

// ---------------------------------------------------------------------------
// Table detection helpers
// ---------------------------------------------------------------------------

interface TableInfo {
  /** First line number of the table (1-based) */
  startLine: number
  /** Last line number of the table (1-based) */
  endLine: number
  /** Parsed rows: each row is an array of cell strings */
  rows: string[][]
  /** Character offset of the first character of the table */
  from: number
  /** Character offset just past the last character of the table */
  to: number
}

const TABLE_ROW_RE = /^\|(.+)\|$/

function isTableRow(text: string): boolean {
  return TABLE_ROW_RE.test(text.trim())
}

function isSeparatorRow(text: string): boolean {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(text.trim())
}

function parseCells(row: string): string[] {
  // Strip leading/trailing pipe and split by |
  const trimmed = row.trim().replace(/^\||\|$/g, '')
  return trimmed.split('|').map((c) => c.trim())
}

/**
 * Find the table that contains `lineNumber` (1-based).
 */
function findTableAt(view: EditorView, lineNumber: number): TableInfo | null {
  const doc = view.state.doc
  const lineText = doc.line(lineNumber).text
  if (!isTableRow(lineText)) return null

  // Walk up to find start
  let startLine = lineNumber
  while (startLine > 1 && isTableRow(doc.line(startLine - 1).text)) {
    startLine--
  }

  // Walk down to find end
  let endLine = lineNumber
  while (endLine < doc.lines && isTableRow(doc.line(endLine + 1).text)) {
    endLine++
  }

  // Need at least 2 rows (header + separator or header + data)
  if (endLine - startLine < 1) return null

  const rows: string[][] = []
  for (let i = startLine; i <= endLine; i++) {
    rows.push(parseCells(doc.line(i).text))
  }

  return {
    startLine,
    endLine,
    rows,
    from: doc.line(startLine).from,
    to: doc.line(endLine).to,
  }
}

// ---------------------------------------------------------------------------
// Table formatting
// ---------------------------------------------------------------------------

function formatTable(rows: string[][]): string {
  if (rows.length === 0) return ''

  // Determine column count (max across all rows)
  const colCount = Math.max(...rows.map((r) => r.length))

  // Normalise row lengths
  const normalised = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push('')
    return copy
  })

  // Compute max width per column
  const widths = Array.from({ length: colCount }, (_, col) =>
    Math.max(3, ...normalised.map((r) => r[col].length)),
  )

  // Build formatted lines
  return normalised
    .map((row, rowIdx) => {
      const cells = row.map((cell, col) => {
        if (rowIdx === 1 && isSeparatorCell(cell)) {
          return '-'.repeat(widths[col])
        }
        return cell.padEnd(widths[col])
      })
      return `| ${cells.join(' | ')} |`
    })
    .join('\n')
}

function isSeparatorCell(cell: string): boolean {
  return /^[\s:]*-+[\s:]*$/.test(cell)
}

// ---------------------------------------------------------------------------
// Table render widget
// ---------------------------------------------------------------------------

class TableWidget extends WidgetType {
  constructor(readonly rows: string[][]) {
    super()
  }

  eq(other: TableWidget): boolean {
    if (this.rows.length !== other.rows.length) return false
    return this.rows.every((row, i) =>
      row.length === other.rows[i].length &&
      row.every((cell, j) => cell === other.rows[i][j]),
    )
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'

    const table = document.createElement('table')
    table.className = 'cm-table'

    this.rows.forEach((row, rowIdx) => {
      // Row index 1 is the separator row — skip it
      if (rowIdx === 1) return

      const tr = document.createElement('tr')
      const isHeader = rowIdx === 0

      row.forEach((cell) => {
        const td = document.createElement(isHeader ? 'th' : 'td')
        td.textContent = cell
        tr.appendChild(td)
      })

      if (isHeader) {
        let thead = table.querySelector('thead')
        if (!thead) {
          thead = document.createElement('thead')
          table.appendChild(thead)
        }
        thead.appendChild(tr)
      } else {
        let tbody = table.querySelector('tbody')
        if (!tbody) {
          tbody = document.createElement('tbody')
          table.appendChild(tbody)
        }
        tbody.appendChild(tr)
      }
    })

    wrapper.appendChild(table)
    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Table render ViewPlugin
// ---------------------------------------------------------------------------

/**
 * Scan the entire document for markdown tables and collect their info.
 * Returns all distinct tables (each as a TableInfo).
 */
function findAllTables(view: EditorView): TableInfo[] {
  const doc = view.state.doc
  const tables: TableInfo[] = []
  let lineNum = 1

  while (lineNum <= doc.lines) {
    const lineText = doc.line(lineNum).text
    if (isTableRow(lineText)) {
      const table = findTableAt(view, lineNum)
      if (table) {
        tables.push(table)
        lineNum = table.endLine + 1
        continue
      }
    }
    lineNum++
  }

  return tables
}

function cursorInsideTable(view: EditorView, table: TableInfo): boolean {
  const sel = view.state.selection.main
  const cursorLine = view.state.doc.lineAt(sel.head).number
  return cursorLine >= table.startLine && cursorLine <= table.endLine
}

function findAllTablesFromDoc(doc: { lines: number; line(n: number): { text: string; from: number; to: number } }): TableInfo[] {
  const tables: TableInfo[] = []
  let lineNum = 1

  while (lineNum <= doc.lines) {
    const lineText = doc.line(lineNum).text
    if (isTableRow(lineText)) {
      // Walk up
      let startLine = lineNum
      while (startLine > 1 && isTableRow(doc.line(startLine - 1).text)) startLine--
      // Walk down
      let endLine = lineNum
      while (endLine < doc.lines && isTableRow(doc.line(endLine + 1).text)) endLine++
      if (endLine - startLine >= 1) {
        const rows: string[][] = []
        for (let i = startLine; i <= endLine; i++) rows.push(parseCells(doc.line(i).text))
        tables.push({
          startLine, endLine, rows,
          from: doc.line(startLine).from,
          to: doc.line(endLine).to,
        })
        lineNum = endLine + 1
        continue
      }
    }
    lineNum++
  }
  return tables
}

const tableRenderField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecosFromState(state.doc, state.selection.main.head, state.facet(viewerModeFacet))
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection || tr.reconfigured) {
      return buildTableDecosFromState(tr.state.doc, tr.state.selection.main.head, tr.state.facet(viewerModeFacet))
    }
    return decos
  },
  provide(field) {
    return EditorView.decorations.from(field)
  },
})

function buildTableDecosFromState(
  doc: { lines: number; line(n: number): { text: string; from: number; to: number }; lineAt(pos: number): { number: number } },
  selHead: number,
  viewerMode = false,
): DecorationSet {
  const tables = findAllTablesFromDoc(doc)
  const decorations: Range<Decoration>[] = []
  const cursorLine = doc.lineAt(selHead).number

  for (const table of tables) {
    if (!viewerMode && cursorLine >= table.startLine && cursorLine <= table.endLine) continue

    decorations.push(
      Decoration.replace({
        widget: new TableWidget(table.rows),
        block: true,
      }).range(table.from, table.to),
    )
  }

  return Decoration.set(decorations, true)
}

const tableBaseTheme = EditorView.baseTheme({
  '.cm-table-widget': {
    display: 'block',
    overflowX: 'auto',
    margin: '8px 0',
  },
  '.cm-table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.95em',
  },
  '.cm-table th, .cm-table td': {
    border: '1px solid var(--md-table-border, #dfe2e5)',
    padding: '6px 13px',
    textAlign: 'left',
  },
  '.cm-table th': {
    background: 'var(--md-table-header-bg, #eaecef)',
    fontWeight: '700',
  },
  '.cm-table thead tr': {
    borderBottom: '2px solid var(--border, #ddd)',
  },
  '.cm-table tr:nth-child(even) td': {
    background: 'var(--md-table-stripe-bg, #f6f8fa)',
  },
})

// ---------------------------------------------------------------------------
// Cell navigation helpers
// ---------------------------------------------------------------------------

interface CellPosition {
  row: number // 0-based index within table rows
  col: number // 0-based column
}

function findCurrentCell(
  view: EditorView,
  table: TableInfo,
): CellPosition | null {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  const row = line.number - table.startLine
  if (row < 0 || row > table.endLine - table.startLine) return null

  // Walk through the line text to figure out which column the cursor is in
  const lineText = line.text
  let col = 0
  const cursorOffset = head - line.from

  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '|') {
      if (i > 0) col++
    }
    if (i >= cursorOffset) break
  }

  // Adjust: the first | doesn't count as a column boundary in our model
  return { row, col: Math.max(0, col - 1) }
}

/**
 * Move cursor to a specific cell in the table.
 */
function moveToCellOffset(
  view: EditorView,
  table: TableInfo,
  row: number,
  col: number,
): void {
  const targetLineNum = table.startLine + row
  if (targetLineNum < 1 || targetLineNum > view.state.doc.lines) return

  const line = view.state.doc.line(targetLineNum)
  const lineText = line.text
  // Find the nth pipe to locate the cell
  let pipeCount = 0
  let cellStart = 0

  for (let i = 0; i < lineText.length; i++) {
    if (lineText[i] === '|') {
      pipeCount++
      if (pipeCount === col + 1) {
        // We've found the pipe before our target cell
        cellStart = i + 1
        break
      }
    }
  }

  // Skip leading whitespace in the cell
  while (cellStart < lineText.length && lineText[cellStart] === ' ') {
    cellStart++
  }

  const offset = line.from + cellStart
  view.dispatch({
    selection: EditorSelection.cursor(offset),
  })
}

// ---------------------------------------------------------------------------
// Key handlers
// ---------------------------------------------------------------------------

function handleTab(view: EditorView, shift: boolean): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const table = findTableAt(view, line.number)
  if (!table) return false

  const cell = findCurrentCell(view, table)
  if (!cell) return false

  const colCount = table.rows[0]?.length ?? 0
  const rowCount = table.rows.length

  let nextRow = cell.row
  let nextCol = cell.col + (shift ? -1 : 1)

  if (nextCol >= colCount) {
    nextCol = 0
    nextRow++
    // Skip separator row
    if (nextRow === 1 && rowCount > 2) nextRow = 2
    else if (nextRow < rowCount && isSeparatorRow(view.state.doc.line(table.startLine + nextRow).text)) {
      nextRow++
    }
  } else if (nextCol < 0) {
    nextCol = colCount - 1
    nextRow--
    // Skip separator row
    if (nextRow === 1 && table.rows.length > 2) nextRow = 0
    else if (nextRow >= 0 && isSeparatorRow(view.state.doc.line(table.startLine + nextRow).text)) {
      nextRow--
    }
  }

  if (nextRow < 0 || nextRow >= rowCount) return false

  moveToCellOffset(view, table, nextRow, nextCol)
  return true
}

function handleEnter(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const table = findTableAt(view, line.number)
  if (!table) return false

  const colCount = table.rows[0]?.length ?? 3
  // Create a new empty row at the end of the table
  const emptyRow =
    '| ' + Array.from({ length: colCount }, () => '   ').join(' | ') + ' |'
  const insertPos = view.state.doc.line(table.endLine).to

  view.dispatch({
    changes: { from: insertPos, insert: '\n' + emptyRow },
    selection: EditorSelection.cursor(insertPos + 1),
  })

  // After the transaction, move cursor to first cell of new row
  requestAnimationFrame(() => {
    const newTable = findTableAt(view, table.endLine + 1)
    if (newTable) {
      moveToCellOffset(view, newTable, newTable.endLine - newTable.startLine, 0)
    }
  })

  return true
}

// ---------------------------------------------------------------------------
// Format-on-blur plugin
// ---------------------------------------------------------------------------

const tableFormatPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none

    constructor(_view: EditorView) {}

    update(_update: ViewUpdate) {
      // Decorations are unused – we keep this for future visual hints.
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      blur(_event: FocusEvent, view: EditorView) {
        formatAllTables(view)
      },
    },
  },
)

function formatAllTables(view: EditorView): void {
  const doc = view.state.doc
  const changes: { from: number; to: number; insert: string }[] = []

  let lineNum = 1
  while (lineNum <= doc.lines) {
    const lineText = doc.line(lineNum).text
    if (isTableRow(lineText)) {
      const table = findTableAt(view, lineNum)
      if (table) {
        const formatted = formatTable(table.rows)
        const original = doc.sliceString(table.from, table.to)
        if (formatted !== original) {
          changes.push({ from: table.from, to: table.to, insert: formatted })
        }
        lineNum = table.endLine + 1
        continue
      }
    }
    lineNum++
  }

  if (changes.length > 0) {
    view.dispatch({ changes })
  }
}

// ---------------------------------------------------------------------------
// Keymap
// ---------------------------------------------------------------------------

const tableKeymap = keymap.of([
  {
    key: 'Tab',
    run: (view) => handleTab(view, false),
  },
  {
    key: 'Shift-Tab',
    run: (view) => handleTab(view, true),
  },
  {
    key: 'Enter',
    run: (view) => handleEnter(view),
  },
])

// ---------------------------------------------------------------------------
// Insert table command
// ---------------------------------------------------------------------------

/**
 * Insert a 3x3 markdown table template at the current cursor position.
 */
export function insertTable(view: EditorView): void {
  const head = view.state.selection.main.head
  const template = [
    '| Header 1 | Header 2 | Header 3 |',
    '| -------- | -------- | -------- |',
    '|          |          |          |',
    '|          |          |          |',
    '|          |          |          |',
  ].join('\n')

  // Insert a blank line before if the cursor isn't at the start of a line
  const line = view.state.doc.lineAt(head)
  const prefix = line.text.trim() === '' ? '' : '\n'
  const insert = prefix + template + '\n'

  view.dispatch({
    changes: { from: head, insert },
    selection: EditorSelection.cursor(head + prefix.length + template.indexOf('Header 1')),
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension for enhanced markdown table editing:
 * - Tab / Shift-Tab navigate between cells
 * - Enter adds a new row
 * - Tables are auto-formatted on blur
 * - Tables are rendered as HTML when cursor is not inside them
 */
export function tablePlugin(): Extension {
  return [tableRenderField, tableBaseTheme, tableKeymap, tableFormatPlugin]
}
