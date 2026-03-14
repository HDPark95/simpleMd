/**
 * File tree sidebar component for SimpleMD.
 * Provides recursive, lazy-loaded folder browsing with .md file opening.
 */

/* ── Icon helpers ─────────────────────────────────────────── */

const FILE_ICONS: Record<string, string> = {
  '.md': '📝',
  '.markdown': '📝',
  '.json': '{ }',
  '.ts': 'TS',
  '.tsx': 'TX',
  '.js': 'JS',
  '.jsx': 'JX',
  '.css': '#',
  '.html': '<>',
  '.yml': 'Y',
  '.yaml': 'Y',
  '.toml': 'T',
  '.xml': '<>',
  '.svg': '◇',
  '.png': '▣',
  '.jpg': '▣',
  '.jpeg': '▣',
  '.gif': '▣',
  '.txt': '≡',
}

function getFileIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [ext, icon] of Object.entries(FILE_ICONS)) {
    if (lower.endsWith(ext)) return icon
  }
  return '📄'
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
  row.style.paddingLeft = `${8 + depth * 18}px`

  if (entry.isDirectory) {
    // Arrow toggle
    const arrow = document.createElement('span')
    arrow.className = 'tree-arrow'
    arrow.textContent = '▶'

    // Folder icon
    const icon = document.createElement('span')
    icon.className = 'tree-icon tree-icon--folder'
    icon.textContent = '📁'

    // Label
    const label = document.createElement('span')
    label.className = 'tree-label'
    label.textContent = entry.name

    // Badge (item count) — filled after first load
    const badge = document.createElement('span')
    badge.className = 'tree-badge'
    badge.style.display = 'none'

    row.appendChild(arrow)
    row.appendChild(icon)
    row.appendChild(label)
    row.appendChild(badge)
    item.appendChild(row)

    const children = document.createElement('div')
    children.className = 'tree-children'
    item.appendChild(children)

    let loaded = false

    row.addEventListener('click', async () => {
      const isOpen = item.classList.contains('tree-item--open')
      if (!isOpen) {
        item.classList.add('tree-item--open')
        arrow.textContent = '▼'
        icon.textContent = '📂'
        if (!loaded) {
          loaded = true
          const count = await loadChildren(entry.path, children, depth + 1)
          if (count > 0) {
            badge.textContent = String(count)
            badge.style.display = ''
          }
        }
      } else {
        item.classList.remove('tree-item--open')
        arrow.textContent = '▶'
        icon.textContent = '📁'
      }
    })
  } else {
    // Spacer to align with arrow width
    const spacer = document.createElement('span')
    spacer.className = 'tree-arrow-spacer'

    // File icon
    const icon = document.createElement('span')
    icon.className = 'tree-icon tree-icon--file'
    icon.textContent = getFileIcon(entry.name)

    // Label
    const label = document.createElement('span')
    label.className = 'tree-label'
    label.textContent = entry.name

    row.appendChild(spacer)
    row.appendChild(icon)
    row.appendChild(label)
    item.appendChild(row)

    // Only allow opening .md files
    if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
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
}

/* ── Public init ──────────────────────────────────────────── */

export function initSidebar(onFileOpen: (path: string, content: string) => void): void {
  onFileOpenCb = onFileOpen

  const sidebar = document.getElementById('sidebar')

  // Open folder button
  const openBtn = document.getElementById('btn-open-folder')
  if (openBtn) {
    openBtn.addEventListener('click', openFolder)
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

  // Highlight the opened file after tree is loaded
  setActiveFile(filePath)
}

export { setActiveFile }
