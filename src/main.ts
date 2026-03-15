/**
 * Main renderer entry point for SimpleMD.
 * Wires together CodeMirror editor, sidebar, outline, statusbar, toolbar, tabs, and features.
 */

import { createEditor, SimpleMDEditor } from './editor/index'
import { extractHeadings, countWords } from './editor/markdown'
import { initSidebar, setActiveFile, openFolderForFile } from './components/sidebar'
import { initOutline, updateOutline, highlightHeading } from './components/outline'
import { initStatusbar, updateStatus, updateStatusMode } from './components/statusbar'
import { initToolbar, setToolbarMode } from './components/toolbar'
import { initTheme, setTheme } from './editor/theme'
import {
  initTabBar,
  openFileInTab,
  createBlankTab,
  updateActiveTabState,
  getActiveTabState,
  handleTabKeyboard,
  type TabState,
} from './components/tabbar'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentFilePath: string | null = null
let isModified = false
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let editor: SimpleMDEditor

/** Whether the app is currently in viewer (read-only) mode. */
let isViewerMode = false

/** Recent file history (most recent first, max 20) */
const MAX_HISTORY = 20
let fileHistory: string[] = []

function loadHistory(): void {
  try {
    const raw = localStorage.getItem('simplemd-file-history')
    if (raw) fileHistory = JSON.parse(raw)
  } catch { /* ignore */ }
}

function saveHistory(): void {
  localStorage.setItem('simplemd-file-history', JSON.stringify(fileHistory))
}

function addToHistory(filePath: string): void {
  fileHistory = [filePath, ...fileHistory.filter(p => p !== filePath)].slice(0, MAX_HISTORY)
  saveHistory()
}

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
// Sidebar resize
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH_KEY = 'simplemd-sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 250
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 520

let preferredSidebarWidth = DEFAULT_SIDEBAR_WIDTH

function normalizeSidebarWidth(w: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w))
}

function applySidebarWidth(width: number, persist = false): void {
  preferredSidebarWidth = normalizeSidebarWidth(width)
  const sidebar = document.getElementById('sidebar')
  if (sidebar && !sidebar.classList.contains('hidden')) {
    sidebar.style.width = `${preferredSidebarWidth}px`
    sidebar.style.minWidth = `${preferredSidebarWidth}px`
    sidebar.style.maxWidth = `${preferredSidebarWidth}px`
  }
  if (persist) {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(preferredSidebarWidth))
  }
}

function initSidebarResize(): void {
  // Load persisted width
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY)
  if (saved) preferredSidebarWidth = normalizeSidebarWidth(parseInt(saved, 10))

  const resizer = document.getElementById('sidebar-resizer')
  const app = document.getElementById('app')
  if (!resizer || !app) return

  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    document.body.classList.add('sidebar-resizing')
    const appLeft = app.getBoundingClientRect().left

    const onMove = (ev: MouseEvent) => {
      const nextWidth = ev.clientX - appLeft
      applySidebarWidth(nextWidth, true)
    }

    const onUp = () => {
      document.body.classList.remove('sidebar-resizing')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
  })

  // Double-click to reset width
  resizer.addEventListener('dblclick', () => {
    applySidebarWidth(DEFAULT_SIDEBAR_WIDTH, true)
  })
}

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
  updateActiveTabState({ isModified: modified })
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
    updateActiveTabState({ filePath: result, title: result.split('/').pop() || 'Untitled' })
  }
}

function showRecentFiles(): void {
  // Remove existing overlay if any
  document.querySelector('.recent-files-overlay')?.remove()

  if (fileHistory.length === 0) return

  const overlay = document.createElement('div')
  overlay.className = 'recent-files-overlay'

  const panel = document.createElement('div')
  panel.className = 'recent-files-panel'

  const title = document.createElement('div')
  title.className = 'recent-files-title'
  title.textContent = 'Recent Files'
  panel.appendChild(title)

  let selectedIdx = 0

  const items: HTMLElement[] = []

  for (let i = 0; i < fileHistory.length; i++) {
    const fp = fileHistory[i]
    const item = document.createElement('div')
    item.className = 'recent-files-item'
    if (i === 0) item.classList.add('selected')
    if (fp === currentFilePath) item.classList.add('current')

    const name = fp.split('/').pop() || fp
    const dir = fp.substring(0, fp.lastIndexOf('/'))

    item.innerHTML = `<span class="recent-files-name">${name}</span><span class="recent-files-path">${dir}</span>`

    item.addEventListener('click', () => {
      close()
      openFromHistory(fp)
    })
    item.addEventListener('mouseenter', () => {
      items[selectedIdx]?.classList.remove('selected')
      selectedIdx = i
      item.classList.add('selected')
    })

    panel.appendChild(item)
    items.push(item)
  }

  overlay.appendChild(panel)

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onKey)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown' || (e.key === 'r' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault()
      items[selectedIdx]?.classList.remove('selected')
      selectedIdx = (selectedIdx + 1) % items.length
      items[selectedIdx]?.classList.add('selected')
      items[selectedIdx]?.scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[selectedIdx]?.classList.remove('selected')
      selectedIdx = (selectedIdx - 1 + items.length) % items.length
      items[selectedIdx]?.classList.add('selected')
      items[selectedIdx]?.scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      close()
      openFromHistory(fileHistory[selectedIdx])
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  document.addEventListener('keydown', onKey)
  document.body.appendChild(overlay)
}

async function openFromHistory(filePath: string): Promise<void> {
  if (!window.simplemd) return
  const content = await window.simplemd.file.read(filePath)
  if (content !== null) {
    openContent(filePath, content)
    openFolderForFile(filePath)
  }
}

async function autoSaveIfNeeded(): Promise<void> {
  if (isModified && currentFilePath && window.simplemd) {
    const content = editor.getContent()
    await window.simplemd.file.save({ filePath: currentFilePath, content })
    setModified(false)
  }
}

/**
 * Load content into the editor via tabs.
 */
function openContent(filePath: string | null, content: string, viewerMode?: boolean): void {
  const mode = viewerMode !== undefined ? viewerMode : filePath !== null
  openFileInTab(filePath, content, mode)
}

/**
 * Restore a tab's state into the editor — called by the tab system.
 */
function restoreTabToEditor(tab: TabState): void {
  currentFilePath = tab.filePath
  if (tab.filePath) addToHistory(tab.filePath)

  editor.setContent(tab.content)
  isModified = tab.isModified

  updateWindowTitle()
  const words = countWords(tab.content)
  updateStatus({
    file: tab.filePath || '',
    modified: tab.isModified,
    words: words.words,
    chars: words.chars,
  })
  updateOutline(extractHeadings(tab.content))

  applyMode(tab.isViewerMode)

  // Restore scroll position
  requestAnimationFrame(() => {
    editor.view.scrollDOM.scrollTop = tab.scrollTop
  })

  if (tab.filePath) {
    setActiveFile(tab.filePath)
  }

  // Update sidebar toggle button state
  updateSidebarToggleState()
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
// Sidebar toggle
// ---------------------------------------------------------------------------

function toggleSidebar(): void {
  const sidebar = document.getElementById('sidebar')
  const resizer = document.getElementById('sidebar-resizer')
  if (!sidebar) return

  const isHidden = sidebar.classList.contains('hidden')
  sidebar.classList.toggle('hidden')

  if (isHidden) {
    // Showing sidebar — apply persisted width
    applySidebarWidth(preferredSidebarWidth)
    resizer?.classList.remove('hidden')
  } else {
    resizer?.classList.add('hidden')
  }

  updateSidebarToggleState()
}

function updateSidebarToggleState(): void {
  const sidebar = document.getElementById('sidebar')
  const btn = document.getElementById('btn-toggle-sidebar')
  if (!sidebar || !btn) return
  btn.classList.toggle('active', !sidebar.classList.contains('hidden'))
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

function init(): void {
  loadHistory()
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

  // Initialize sidebar resize
  initSidebarResize()

  // Initialize UI components
  initSidebar(
    async (path, content) => { openContent(path, content) },
    () => { toggleSidebar() },
  )

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

  // Initialize tab bar
  initTabBar({
    onActivate: (tab) => restoreTabToEditor(tab),
    onCreate: (tab) => restoreTabToEditor(tab),
    onClose: async (tab) => {
      if (!tab.isModified) return true
      // Simple confirm dialog
      return confirm(`"${tab.title}" has unsaved changes. Close anyway?`)
    },
    onSaveState: () => ({
      content: editor.getContent(),
      filePath: currentFilePath,
      isModified,
      scrollTop: editor.view.scrollDOM.scrollTop,
      isViewerMode,
      title: currentFilePath ? currentFilePath.split('/').pop() || 'Untitled' : 'Untitled',
    }),
  })

  // Sidebar toggle button
  const sidebarToggleBtn = document.getElementById('btn-toggle-sidebar')
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', toggleSidebar)
    sidebarToggleBtn.addEventListener('mousedown', (e) => e.preventDefault())
  }

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
  // Keyboard shortcuts
  // --------------------------------------------------

  window.addEventListener('keydown', (e) => {
    // Tab shortcuts first (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+T)
    if (handleTabKeyboard(e)) return

    const isMod = e.metaKey || e.ctrlKey
    if (isMod && e.key === 'e') {
      e.preventDefault()
      toggleMode()
    }
    if (isMod && e.key === 'r') {
      e.preventDefault()
      showRecentFiles()
    }
    // Cmd+\: toggle sidebar
    if (isMod && e.key === '\\') {
      e.preventDefault()
      toggleSidebar()
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
    ipc.on('menu:new', () => { createBlankTab() })
    ipc.on('menu:toggleViewerMode', () => toggleMode())

    ipc.on('menu:open', async () => {
      const result = await ipc.file.open()
      if (result) {
        openContent(result.filePath, result.content)
        openFolderForFile(result.filePath)
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

    // Sidebar toggle from menu
    ipc.on('menu:toggleSidebar', () => {
      toggleSidebar()
    })

    // --------------------------------------------------
    // Open file from main process (command line arg)
    // --------------------------------------------------

    ipc.on('file:openFromMain', (...args: unknown[]) => {
      const data = args[0] as { filePath: string | null; content: string; mode?: string; line?: number }
      if (data) {
        const viewerMode = data.mode === 'view' ? true : undefined
        openContent(data.filePath, data.content, viewerMode)
        if (data.filePath) openFolderForFile(data.filePath)

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
    // File changed externally — reload content
    // --------------------------------------------------

    ipc.on('file:changed', (...args: unknown[]) => {
      const data = args[0] as { filePath: string; content: string }
      if (data && data.filePath === currentFilePath && !isModified) {
        // Save scroll position
        const scroller = editor.view.scrollDOM
        const scrollTop = scroller.scrollTop
        editor.setContent(data.content)
        setModified(false)
        updateOutline(extractHeadings(data.content))
        const words = countWords(data.content)
        updateStatus({ words: words.words, chars: words.chars })
        // Restore scroll
        requestAnimationFrame(() => { scroller.scrollTop = scrollTop })
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
        openFolderForFile(filePath)
      }
    })
  } // end if (ipc)

  // --------------------------------------------------
  // Welcome text — open as first tab
  // --------------------------------------------------

  openFileInTab(null, WELCOME_TEXT, false)
}

// Boot
init()
