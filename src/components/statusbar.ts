/**
 * Status bar component for SimpleMD.
 * Displays file name, modified state, cursor position, document statistics,
 * and the current viewer/edit mode.
 */

interface StatusData {
  file?: string
  modified?: boolean
  cursor?: { line: number; col: number }
  words?: number
  chars?: number
}

const elements = {
  file: null as HTMLElement | null,
  modified: null as HTMLElement | null,
  cursor: null as HTMLElement | null,
  words: null as HTMLElement | null,
  chars: null as HTMLElement | null,
  mode: null as HTMLElement | null,
}

export function initStatusbar(): void {
  elements.file = document.getElementById('status-file')
  elements.modified = document.getElementById('status-modified')
  elements.cursor = document.getElementById('status-cursor')
  elements.words = document.getElementById('status-words')
  elements.chars = document.getElementById('status-chars')
  elements.mode = document.getElementById('status-mode')
}

export function updateStatus(data: StatusData): void {
  if (data.file !== undefined && elements.file) {
    // Show just the file name, not the full path
    const fileName = data.file ? data.file.split('/').pop() || data.file : 'Untitled'
    elements.file.textContent = fileName
    elements.file.title = data.file || 'Untitled'
  }

  if (data.modified !== undefined && elements.modified) {
    elements.modified.textContent = data.modified ? '\u00B7' : ''
    elements.modified.classList.toggle('status-modified-dot', data.modified)
  }

  if (data.cursor !== undefined && elements.cursor) {
    elements.cursor.textContent = `Ln ${data.cursor.line}, Col ${data.cursor.col}`
  }

  if (data.words !== undefined && elements.words) {
    elements.words.textContent = `${data.words} word${data.words !== 1 ? 's' : ''}`
  }

  if (data.chars !== undefined && elements.chars) {
    elements.chars.textContent = `${data.chars} char${data.chars !== 1 ? 's' : ''}`
  }
}

/**
 * Update the mode indicator in the status bar.
 * @param isViewer - true for viewer/read-only mode, false for edit mode.
 */
export function updateStatusMode(isViewer: boolean): void {
  const el = elements.mode
  if (!el) return

  if (isViewer) {
    el.textContent = 'Read Only'
    el.classList.remove('status-mode--editing')
    el.classList.add('status-mode--viewer')
  } else {
    el.textContent = 'Editing'
    el.classList.remove('status-mode--viewer')
    el.classList.add('status-mode--editing')
  }
}
