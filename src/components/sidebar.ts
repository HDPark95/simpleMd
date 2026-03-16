/**
 * File tree sidebar component for SimpleMD.
 * Provides recursive, lazy-loaded folder browsing with .md file opening.
 */

/* ── Icon helpers ─────────────────────────────────────────── */

/* ── SVG Icon helpers ─────────────────────────────────────── */

const FOLDER_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/></svg>`
const FOLDER_OPEN_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H13.5A1.5 1.5 0 0115 5.5v.5H2.5a1 1 0 00-.994.89l-.476 4.29A1.5 1.5 0 002.5 13h11a1.5 1.5 0 001.48-1.32l.78-5a.5.5 0 00-.49-.58H2V5.5a.5.5 0 01.5-.5h4.12a.5.5 0 00.354-.146l1.207-1.208A.5.5 0 008.535 3.5H2.5a.5.5 0 00-.5.5v8.5z"/></svg>`
const FILE_MD_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zM9.5 3A1.5 1.5 0 018 1.5V0H4a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V4.5H9.5z"/><path d="M4.5 12.5A.5.5 0 015 12h3.5v-2l1.5 2.5L11.5 10v2H12a.5.5 0 010 1H5a.5.5 0 01-.5-.5z"/></svg>`
const FILE_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zM9.5 3A1.5 1.5 0 018 1.5V0H4a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V4.5H9.5z"/></svg>`
const CHEVRON_RIGHT = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"/></svg>`
const CHEVRON_DOWN = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 01.708 0L8 10.293l5.646-5.647a.5.5 0 01.708.708l-6 6a.5.5 0 01-.708 0l-6-6a.5.5 0 010-.708z"/></svg>`

const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt',
  '.sql', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv', '.tsv',
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.html', '.css', '.scss', '.less', '.sass',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.ps1',
  '.env', '.ini', '.cfg', '.conf', '.properties',
  '.diff', '.patch', '.log',
  '.r', '.lua', '.pl', '.php', '.ex', '.exs', '.hs', '.clj', '.scala',
  '.dockerfile', '.gitignore', '.editorconfig',
])

function isOpenable(name: string): boolean {
  const lower = name.toLowerCase()
  const dotIdx = lower.lastIndexOf('.')
  if (dotIdx === -1) return false
  return TEXT_EXTENSIONS.has(lower.slice(dotIdx))
}

function isMarkdown(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')
}

function getFileIconSvg(name: string): string {
  return isMarkdown(name) ? FILE_MD_ICON : FILE_ICON
}

/* ── State ────────────────────────────────────────────────── */

let onFileOpenCb: ((path: string, content: string) => void) | null = null
let currentOpenPath: string | null = null
let rootFolderPath: string | null = null

/* ── Sort helper ──────────────────────────────────────────── */

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/* ── Tree node creation ───────────────────────────────────── */

function createFileNode(entry: FileEntry, container: HTMLElement, depth: number): HTMLElement {
  const item = document.createElement('div')
  item.className = 'tree-item'
  item.dataset.path = entry.path
  item.dataset.isDir = String(entry.isDirectory)

  const row = document.createElement('div')
  row.className = 'tree-row'
  row.style.paddingLeft = `${12 + depth * 16}px`

  if (entry.isDirectory) {
    // Chevron toggle
    const arrow = document.createElement('span')
    arrow.className = 'tree-arrow'
    arrow.innerHTML = CHEVRON_RIGHT

    // Folder icon
    const icon = document.createElement('span')
    icon.className = 'tree-icon tree-icon--folder'
    icon.innerHTML = FOLDER_ICON

    // Label
    const label = document.createElement('span')
    label.className = 'tree-label'
    label.textContent = entry.name

    row.appendChild(arrow)
    row.appendChild(icon)
    row.appendChild(label)
    item.appendChild(row)

    const children = document.createElement('div')
    children.className = 'tree-children'
    item.appendChild(children)

    let loaded = false

    row.addEventListener('click', async () => {
      const isOpen = item.classList.contains('tree-item--open')
      if (!isOpen) {
        item.classList.add('tree-item--open')
        arrow.innerHTML = CHEVRON_DOWN
        icon.innerHTML = FOLDER_OPEN_ICON
        if (!loaded) {
          loaded = true
          await loadChildren(entry.path, children, depth + 1)
        }
      } else {
        item.classList.remove('tree-item--open')
        arrow.innerHTML = CHEVRON_RIGHT
        icon.innerHTML = FOLDER_ICON
      }
    })
  } else {
    // Spacer to align with arrow width
    const spacer = document.createElement('span')
    spacer.className = 'tree-arrow-spacer'

    // File icon
    const icon = document.createElement('span')
    icon.className = 'tree-icon tree-icon--file'
    icon.innerHTML = getFileIconSvg(entry.name)

    // Label
    const label = document.createElement('span')
    label.className = 'tree-label'
    label.textContent = entry.name

    row.appendChild(spacer)
    row.appendChild(icon)
    row.appendChild(label)
    item.appendChild(row)

    // Allow opening text-based files
    if (isOpenable(entry.name)) {
      row.addEventListener('click', async () => {
        if (!window.simplemd) return
        const content = await window.simplemd.file.read(entry.path)
        if (content !== null && onFileOpenCb) {
          setActiveFile(entry.path)
          onFileOpenCb(entry.path, content)
        }
      })
    } else {
      row.classList.add('tree-row--disabled')
    }
  }

  container.appendChild(item)
  return item
}

/* ── Load directory children ──────────────────────────────── */

async function loadChildren(dirPath: string, container: HTMLElement, depth: number): Promise<number> {
  container.innerHTML = ''

  try {
    if (!window.simplemd) throw new Error('No IPC')
    const entries = await window.simplemd.file.readDir(dirPath)
    const sorted = sortEntries(entries)

    // Filter hidden files
    const visible = sorted.filter((e) => !e.name.startsWith('.'))

    if (visible.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.style.paddingLeft = `${8 + depth * 18}px`
      empty.textContent = '(empty)'
      container.appendChild(empty)
      return 0
    }

    for (const entry of visible) {
      createFileNode(entry, container, depth)
    }

    return visible.length
  } catch {
    const error = document.createElement('div')
    error.className = 'tree-empty'
    error.textContent = '(error reading folder)'
    container.appendChild(error)
    return 0
  }
}

/* ── Active file highlighting ─────────────────────────────── */

function setActiveFile(path: string): void {
  currentOpenPath = path
  const tree = document.getElementById('file-tree')
  if (!tree) return

  // Remove previous active highlight
  tree.querySelectorAll('.tree-row--active').forEach((el) => {
    el.classList.remove('tree-row--active')
  })

  // Add active class to matching node
  const items = tree.querySelectorAll('.tree-item')
  items.forEach((item) => {
    if ((item as HTMLElement).dataset.path === path) {
      const row = item.querySelector('.tree-row')
      if (row) row.classList.add('tree-row--active')
    }
  })
}

/* ── Open folder ──────────────────────────────────────────── */

async function openFolder(): Promise<void> {
  if (!window.simplemd) return
  const folderPath = await window.simplemd.file.openFolder()
  if (!folderPath) return

  rootFolderPath = folderPath
  const tree = document.getElementById('file-tree')
  if (!tree) return

  tree.innerHTML = ''

  // Update sidebar title with folder name
  const titleEl = document.querySelector('.sidebar-title')
  if (titleEl) {
    const folderName = folderPath.split('/').pop() || folderPath
    titleEl.textContent = folderName
  }

  await loadChildren(folderPath, tree, 0)

  // Make sure sidebar is visible
  const sidebar = document.getElementById('sidebar')
  if (sidebar) sidebar.classList.remove('hidden')
  const resizer = document.getElementById('sidebar-resizer')
  if (resizer) resizer.classList.remove('hidden')
}

/* ── Public init ──────────────────────────────────────────── */

let closeSidebarCb: (() => void) | null = null

export function initSidebar(
  onFileOpen: (path: string, content: string) => void,
  onCloseSidebar?: () => void,
): void {
  onFileOpenCb = onFileOpen
  closeSidebarCb = onCloseSidebar || null

  // Open folder button
  const openBtn = document.getElementById('btn-open-folder')
  if (openBtn) {
    openBtn.addEventListener('click', openFolder)
  }

  // Close sidebar button
  const closeBtn = document.getElementById('btn-close-sidebar')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (closeSidebarCb) closeSidebarCb()
    })
    closeBtn.addEventListener('mousedown', (e) => e.preventDefault())
  }

  // Menu: open folder (Electron only)
  if (window.simplemd) {
    window.simplemd.on('menu:openFolder', () => {
      openFolder()
    })
  }
}

/**
 * Open the parent folder of a file and highlight it in the tree.
 * Called automatically when a file is opened from disk.
 */
export async function openFolderForFile(filePath: string): Promise<void> {
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
  if (!dirPath) return

  // Already showing this folder?
  if (rootFolderPath === dirPath) {
    setActiveFile(filePath)
    return
  }

  rootFolderPath = dirPath
  const tree = document.getElementById('file-tree')
  if (!tree) return

  tree.innerHTML = ''

  const titleEl = document.querySelector('.sidebar-title')
  if (titleEl) {
    const folderName = dirPath.split('/').pop() || dirPath
    titleEl.textContent = folderName
  }

  await loadChildren(dirPath, tree, 0)

  const sidebar = document.getElementById('sidebar')
  if (sidebar) sidebar.classList.remove('hidden')
  const resizer = document.getElementById('sidebar-resizer')
  if (resizer) resizer.classList.remove('hidden')

  // Highlight the opened file after tree is loaded
  setActiveFile(filePath)
}

export { setActiveFile }
