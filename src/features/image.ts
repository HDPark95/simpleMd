import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { Range, EditorSelection } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

// ---------------------------------------------------------------------------
// Image preview widget
// ---------------------------------------------------------------------------

class ImagePreviewWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly width: number | null,
  ) {
    super()
  }

  eq(other: ImagePreviewWidget): boolean {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.width === this.width
    )
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-preview'

    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    if (this.width) img.width = this.width
    img.draggable = false

    img.onerror = () => {
      wrapper.textContent = `[Image not found: ${this.src}]`
      wrapper.style.color = '#999'
      wrapper.style.fontStyle = 'italic'
    }

    // Resize handle
    const handle = document.createElement('div')
    handle.className = 'cm-image-resize-handle'
    handle.title = 'Drag to resize'

    let startX = 0
    let startWidth = 0

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startX = e.clientX
      startWidth = img.offsetWidth

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX))
        img.width = newWidth
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        // The resize result is stored visually only; to persist the width the
        // user should use the <img> HTML syntax.
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    wrapper.appendChild(img)
    wrapper.appendChild(handle)
    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ---------------------------------------------------------------------------
// Find image references in the document
// ---------------------------------------------------------------------------

interface ImageRef {
  from: number
  to: number
  alt: string
  src: string
  width: number | null
}

function findImageRefs(doc: string): ImageRef[] {
  const refs: ImageRef[] = []

  // Markdown images: ![alt](src)
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdRe.exec(doc)) !== null) {
    refs.push({
      from: m.index,
      to: m.index + m[0].length,
      alt: m[1],
      src: m[2],
      width: null,
    })
  }

  // HTML images: <img src="..." width="..." />
  const htmlRe = /<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi
  while ((m = htmlRe.exec(doc)) !== null) {
    const widthMatch = m[0].match(/width=["']?(\d+)["']?/)
    refs.push({
      from: m.index,
      to: m.index + m[0].length,
      alt: '',
      src: m[1],
      width: widthMatch ? parseInt(widthMatch[1], 10) : null,
    })
  }

  return refs
}

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString()
  const images = findImageRefs(doc)
  const decorations: Range<Decoration>[] = []
  const sel = view.state.selection.main

  for (const img of images) {
    // If cursor is on the same line, show raw markdown
    const imgLine = view.state.doc.lineAt(img.from).number
    const cursorLine = view.state.doc.lineAt(sel.head).number
    if (cursorLine === imgLine) continue

    const deco = Decoration.widget({
      widget: new ImagePreviewWidget(img.src, img.alt, img.width),
      side: 1,
    })
    // Place the widget after the image syntax line
    decorations.push(deco.range(img.to))
  }

  return Decoration.set(decorations, true)
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function timestampName(ext: string): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').replace(/\..+/, '')
  return `image-${ts}${ext}`
}

// ---------------------------------------------------------------------------
// Drag & Drop + Paste handler plugin
// ---------------------------------------------------------------------------

const imageDragDropPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none

    constructor(_view: EditorView) {}

    update(_update: ViewUpdate) {}
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      drop(event: DragEvent, view: EditorView) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return
        const imageFiles = Array.from(files).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (imageFiles.length === 0) return

        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return

        for (const file of imageFiles) {
          handleImageFile(view, file, pos)
        }
      },

      paste(event: ClipboardEvent, view: EditorView) {
        const items = event.clipboardData?.items
        if (!items) return

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              const pos = view.state.selection.main.head
              handleImageFile(view, file, pos)
            }
          }
        }
      },
    },
  },
)

async function handleImageFile(
  view: EditorView,
  file: File,
  pos: number,
): Promise<void> {
  const ext = file.name.includes('.')
    ? file.name.substring(file.name.lastIndexOf('.'))
    : '.png'
  const fileName = file.name || timestampName(ext)
  const relativePath = `./assets/${fileName}`

  // Try to save via Electron bridge
  if (typeof window !== 'undefined' && window.simplemd?.file) {
    try {
      // Read the file data for potential saving through IPC.
      // The main process should handle writing via an IPC channel.
      // For now, we just insert the markdown reference.
      await file.arrayBuffer()
    } catch {
      // fall through to insert the reference anyway
    }
  }

  const markdown = `![${file.name}](${relativePath})`
  view.dispatch({
    changes: { from: pos, insert: markdown },
    selection: EditorSelection.cursor(pos + markdown.length),
  })
}

// ---------------------------------------------------------------------------
// Preview plugin
// ---------------------------------------------------------------------------

const imagePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

// ---------------------------------------------------------------------------
// Click-to-preview handler
// ---------------------------------------------------------------------------

const imageClickPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none

    constructor(_view: EditorView) {}

    update(_update: ViewUpdate) {}
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      click(event: MouseEvent, view: EditorView) {
        const target = event.target as HTMLElement
        if (target.tagName === 'IMG' && target.closest('.cm-image-preview')) {
          event.preventDefault()
          const src = (target as HTMLImageElement).src

          // Open a simple overlay preview
          const overlay = document.createElement('div')
          overlay.className = 'cm-image-overlay'
          overlay.addEventListener('click', () => overlay.remove())

          const fullImg = document.createElement('img')
          fullImg.src = src
          fullImg.style.maxWidth = '90vw'
          fullImg.style.maxHeight = '90vh'

          overlay.appendChild(fullImg)
          document.body.appendChild(overlay)
        }
      },
    },
  },
)

// ---------------------------------------------------------------------------
// Base styles
// ---------------------------------------------------------------------------

const imageBaseTheme = EditorView.baseTheme({
  '.cm-image-preview': {
    position: 'relative',
    display: 'inline-block',
    padding: '4px 0',
    cursor: 'pointer',
  },
  '.cm-image-preview img': {
    maxWidth: '100%',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  '.cm-image-resize-handle': {
    position: 'absolute',
    right: '0',
    bottom: '4px',
    width: '12px',
    height: '12px',
    background: '#666',
    borderRadius: '2px',
    cursor: 'nwse-resize',
    opacity: '0',
    transition: 'opacity 0.2s',
  },
  '.cm-image-preview:hover .cm-image-resize-handle': {
    opacity: '0.7',
  },
  '.cm-image-overlay': {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    cursor: 'pointer',
  },
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension for image handling:
 * - Inline image preview widgets
 * - Drag & drop to insert images
 * - Paste from clipboard
 * - Click to preview full-size
 * - Resize handles
 */
export function imagePlugin(): Extension {
  return [
    imagePreviewPlugin,
    imageDragDropPlugin,
    imageClickPlugin,
    imageBaseTheme,
  ]
}
