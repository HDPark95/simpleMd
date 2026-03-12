/**
 * Main renderer entry point for SimpleMD.
 * Wires together CodeMirror editor, sidebar, outline, statusbar, toolbar, and features.
 */

import { createEditor, SimpleMDEditor } from './editor/index'
import { extractHeadings, countWords } from './editor/markdown'
import { initSidebar, setActiveFile } from './components/sidebar'
import { initOutline, updateOutline, highlightHeading } from './components/outline'
import { initStatusbar, updateStatus, updateStatusMode } from './components/statusbar'
import { initToolbar, setToolbarMode } from './components/toolbar'
import { initTheme, setTheme } from './editor/theme'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentFilePath: string | null = null
let isModified = false
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let editor: SimpleMDEditor

/** Whether the app is currently in viewer (read-only) mode. */
let isViewerMode = false

const AUTO_SAVE_DELAY = 2000

const WELCOME_TEXT = `# Welcome to SimpleMD

A beautiful, distraction-free markdown editor.

## Getting Started

Start typing to create your document, or open a folder from the sidebar.

### Formatting

You can use **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

### Lists

- Bullet list item
- Another item
  - Nested item

1. Ordered list
2. Second item

- [x] Task list completed
- [ ] Task list pending

### Code Block

\`\`\`javascript
function hello() {
  console.log("Hello, SimpleMD!");
}
\`\`\`

### Blockquote

> Markdown is a lightweight markup language that you can use
> to add formatting elements to plaintext text documents.

### Table

| Feature   | Status |
|-----------|--------|
| Bold      | Done   |
| Italic    | Done   |
| Tables    | Done   |

### Math (LaTeX)

Inline math: $E = mc^2$

Block math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

### Horizontal Rule

---

Enjoy writing!
`

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function updateWindowTitle(): void {
  const fileName = currentFilePath ? currentFilePath.split('/').pop() || 'Untitled' : 'Untitled'
  const dot = isModified ? ' \u2022' : ''
  document.title = `${fileName}${dot} — SimpleMD`
}

function setModified(modified: boolean): void {
  isModified = modified
  updateStatus({ modified })
  updateWindowTitle()
}

function scheduleAutoSave(): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  if (!currentFilePath) return
  autoSaveTimer = setTimeout(() => {
    if (isModified && currentFilePath) {
      saveFile()
    }
  }, AUTO_SAVE_DELAY)
}

/**
 * Apply the given viewer/edit mode to the editor and all UI components,
 * preserving scroll position and cursor.
 */
function applyMode(viewerMode: boolean): void {
  isViewerMode = viewerMode

  // Preserve scroll position across the reconfigure
  const scrollEl = editor.view.scrollDOM
  const scrollTop = scrollEl.scrollTop

  editor.setReadOnly(viewerMode)

  // Toggle body class for CSS-based cursor/selection hiding
  document.body.classList.toggle('viewer-mode', viewerMode)

  // Restore scroll (reconfigure may reset it)
  requestAnimationFrame(() => {
    scrollEl.scrollTop = scrollTop
  })

  setToolbarMode(viewerMode)
  updateStatusMode(viewerMode)

  if (!viewerMode) {
    editor.view.focus()
  }
}

function toggleMode(): void {
  applyMode(!isViewerMode)
}

async function saveFile(saveAs = false): Promise<void> {
  if (!window.simplemd) return
  const content = editor.getContent()
  const filePath = saveAs ? null : currentFilePath
  const result = await window.simplemd.file.save({ filePath, content })
  if (result) {
    currentFilePath = result
    setModified(false)
    updateStatus({ file: result })
    setActiveFile(result)
    updateWindowTitle()
  }
}

/**
 * Load content into the editor.
 * @param filePath   - Path of the opened file, or null for untitled/welcome.
 * @param content    - Markdown content to display.
 * @param viewerMode - Whether to open in read-only viewer mode (default: true for
 *                     real files, false for untitled/welcome content).
 */
function openContent(filePath: string | null, content: string, viewerMode?: boolean): void {
  currentFilePath = filePath
  editor.setContent(content)
  setModified(false)
  updateWindowTitle()
  const words = countWords(content)
  updateStatus({
    file: filePath || '',
    modified: false,
    words: words.words,
    chars: words.chars,
  })
  updateOutline(extractHeadings(content))

  // Determine mode: caller can override; otherwise files default to viewer,
  // untitled/welcome content defaults to edit.
  const targetMode = viewerMode !== undefined ? viewerMode : filePath !== null
  applyMode(targetMode)

  if (!isViewerMode) {
    editor.view.focus()
  }
}

function applyFormat(action: string): void {
  const view = editor.view
  const { from, to } = view.state.selection.main
  const selectedText = view.state.sliceDoc(from, to)

  const wrap = (before: string, after: string) => {
    view.dispatch({
      changes: { from, to, insert: before + selectedText + after },
      selection: { anchor: from + before.length, head: from + before.length + selectedText.length },
    })
  }

  const prependLine = (prefix: string) => {
    const line = view.state.doc.lineAt(from)
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
    })
  }

  switch (action) {
    case 'bold': wrap('**', '**'); break
    case 'italic': wrap('*', '*'); break
    case 'strikethrough': wrap('~~', '~~'); break
    case 'code': wrap('`', '`'); break
    case 'heading1': prependLine('# '); break
    case 'heading2': prependLine('## '); break
    case 'heading3': prependLine('### '); break
    case 'bulletList': prependLine('- '); break
    case 'orderedList': prependLine('1. '); break
    case 'taskList': prependLine('- [ ] '); break
    case 'blockquote': prependLine('> '); break
    case 'horizontalRule':
      view.dispatch({
        changes: { from, to, insert: '\n---\n' },
      })
      break
    case 'codeBlock':
      view.dispatch({
        changes: { from, to, insert: '\n```\n' + selectedText + '\n```\n' },
      })
      break
    case 'link': wrap('[', '](url)'); break
    case 'image': wrap('![', '](url)'); break
    case 'table':
      view.dispatch({
        changes: {
          from, to,
          insert: '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| cell     | cell     | cell     |\n',
        },
      })
      break
  }
  view.focus()
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

function init(): void {
  const container = document.getElementById('editor-container')
  if (!container) return

  // Initialize theme
  initTheme()

  // Create CodeMirror editor
  editor = createEditor(container)

  // Expose editor API globally for AI agents and automation
  ;(window as any).__simpleMD = {
    getView: () => editor.view,
    getContent: () => editor.view.state.doc.toString(),
    setContent: (text: string) => {
      editor.view.dispatch({
        changes: { from: 0, to: editor.view.state.doc.length, insert: text },
      })
    },
    getSelection: () => {
      const { from, to } = editor.view.state.selection.main
      return editor.view.state.doc.sliceString(from, to)
    },
    goToLine: (line: number) => {
      const lineInfo = editor.view.state.doc.line(line)
      editor.view.dispatch({ selection: { anchor: lineInfo.from }, scrollIntoView: true })
    },
    getWordCount: () => countWords(editor.view.state.doc.toString()),
    getHeadings: () => extractHeadings(editor.view.state.doc.toString()),
    isViewerMode: () => isViewerMode,
    toggleViewerMode: () => {
      document.querySelector('.toolbar-btn.view-toggle')?.dispatchEvent(new MouseEvent('click'))
    },
  }

  // Initialize UI components
  initSidebar((path, content) => {
    openContent(path, content)
  })

  initOutline((line) => {
    const lineInfo = editor.view.state.doc.line(line)
    editor.view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
    })
    editor.view.focus()
  })

  initStatusbar()

  initToolbar(
    (action) => { applyFormat(action) },
    () => { toggleMode() },
  )

  // Listen for custom editor events
  window.addEventListener('editor:cursor', ((e: CustomEvent) => {
    updateStatus({ cursor: { line: e.detail.line, col: e.detail.col } })
    highlightHeading(e.detail.line)
  }) as EventListener)

  window.addEventListener('editor:wordcount', ((e: CustomEvent) => {
    updateStatus({ words: e.detail.words, chars: e.detail.chars })
  }) as EventListener)

  window.addEventListener('editor:modified', ((e: CustomEvent) => {
    if (e.detail.modified) {
      setModified(true)
      scheduleAutoSave()
    }
  }) as EventListener)

  window.addEventListener('editor:headings', ((e: CustomEvent) => {
    updateOutline(e.detail.headings)
  }) as EventListener)

  // --------------------------------------------------
  // Keyboard shortcut: Cmd+E (or Ctrl+E on Windows/Linux) to toggle mode
  // --------------------------------------------------

  window.addEventListener('keydown', (e) => {
    const isMod = e.metaKey || e.ctrlKey
    if (isMod && e.key === 'e') {
      e.preventDefault()
      toggleMode()
    }
    // Cmd+Shift+V: toggle viewer mode
    if (isMod && e.shiftKey && e.key === 'v') {
      e.preventDefault()
      toggleMode()
    }
    // Cmd+P: export PDF
    if (isMod && e.key === 'p') {
      e.preventDefault()
      if (window.simplemd) {
        window.simplemd.export.pdf()
      }
    }
  })

  // --------------------------------------------------
  // IPC menu handlers (Electron only)
  // --------------------------------------------------

  const ipc = window.simplemd ?? null

  if (ipc) {
    ipc.on('menu:new', () => openContent(null, ''))
    ipc.on('menu:toggleViewerMode', () => toggleMode())

    ipc.on('menu:open', async () => {
      const result = await ipc.file.open()
      if (result) {
        openContent(result.filePath, result.content)
        setActiveFile(result.filePath)
      }
    })

    ipc.on('menu:openFolder', () => {
      // Sidebar handles this via its own IPC listener
    })

    ipc.on('menu:save', () => saveFile())
    ipc.on('menu:saveAs', () => saveFile(true))

    // Formatting shortcuts from menu
    const formatActions = [
      'bold', 'italic', 'strikethrough', 'code',
      'heading1', 'heading2', 'heading3',
      'bulletList', 'orderedList', 'taskList',
      'blockquote', 'horizontalRule', 'table',
      'link', 'image', 'codeBlock',
    ]
    for (const action of formatActions) {
      ipc.on(`menu:${action}`, () => applyFormat(action))
    }

    // Export
    ipc.on('menu:exportPdf', async () => {
      await ipc.export.pdf()
    })

    ipc.on('menu:exportHtml', async () => {
      const content = editor.getContent()
      const html = editor.getHTML()
      const title = currentFilePath?.split('/').pop()?.replace(/\.md$/, '') || 'export'
      const fullHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.7; color: #333; }
  code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; }
  img { max-width: 100%; }
  hr { border: none; border-top: 2px solid #eee; margin: 24px 0; }
</style>
</head><body>${html}</body></html>`
      await ipc.export.html({ html: fullHtml, filePath: currentFilePath || 'export.md' })
    })

    // Theme
    ipc.on('theme:change', (...args: unknown[]) => {
      const theme = args[0] as 'light' | 'dark' | 'github'
      setTheme(theme)
    })

    // Focus / typewriter modes
    ipc.on('menu:focusMode', () => {
      document.body.classList.toggle('focus-mode')
    })

    ipc.on('menu:typewriterMode', () => {
      document.body.classList.toggle('typewriter-mode')
    })

    // Find/Replace - programmatically open CM6's search panel
    ipc.on('menu:find', () => {
      editor.view.focus()
      editor.openSearch()
    })

    ipc.on('menu:replace', () => {
      editor.view.focus()
      editor.openSearch()
    })

    // --------------------------------------------------
    // Open file from main process (command line arg)
    // --------------------------------------------------

    ipc.on('file:openFromMain', (...args: unknown[]) => {
      const data = args[0] as { filePath: string | null; content: string; mode?: string; line?: number }
      if (data) {
        const viewerMode = data.mode === 'view' ? true : undefined
        openContent(data.filePath, data.content, viewerMode)
        if (data.filePath) setActiveFile(data.filePath)

        // Jump to line number if specified (--line flag from CLI)
        if (data.line && data.line > 0) {
          const view = editor.view
          const doc = view.state.doc
          const targetLine = Math.min(data.line, doc.lines)
          const lineInfo = doc.line(targetLine)
          view.dispatch({
            selection: { anchor: lineInfo.from },
            scrollIntoView: true,
          })
        }
      }
    })

    // --------------------------------------------------
    // Drag & drop .md files (Electron path – uses ipc.file.read)
    // --------------------------------------------------

    document.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    document.addEventListener('drop', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const file = files[0]
      const isDiffFile = file.name.endsWith('.diff') || file.name.endsWith('.patch')
      if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && !isDiffFile) return
      const filePath = (file as File & { path?: string }).path
      if (!filePath) return
      const content = await ipc.file.read(filePath)
      if (content !== null) {
        openContent(filePath, content, isDiffFile ? true : undefined)
        setActiveFile(filePath)
      }
    })
  } // end if (ipc)

  // --------------------------------------------------
  // Welcome text — open in edit mode so new users can start typing immediately
  // --------------------------------------------------

  openContent(null, WELCOME_TEXT, false)
}

// Boot
init()
