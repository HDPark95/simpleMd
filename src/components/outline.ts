/**
 * Document outline panel for SimpleMD.
 * Shows a navigable tree of headings (H1-H6) extracted from the markdown document.
 */

interface Heading {
  level: number
  text: string
  line: number
}

let onHeadingClickCb: ((line: number) => void) | null = null
let currentHeadings: Heading[] = []
let activeHeadingLine: number | null = null

export function initOutline(onHeadingClick: (line: number) => void): void {
  onHeadingClickCb = onHeadingClick

  const outline = document.getElementById('outline')

  if (window.simplemd) {
    window.simplemd.on('menu:toggleOutline', () => {
      if (outline) outline.classList.toggle('hidden')
    })
  }
}

export function updateOutline(headings: Heading[]): void {
  currentHeadings = headings
  const content = document.getElementById('outline-content')
  if (!content) return

  content.innerHTML = ''

  if (headings.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'outline-empty'
    empty.textContent = 'No headings found'
    content.appendChild(empty)
    return
  }

  for (const heading of headings) {
    const item = document.createElement('div')
    item.className = 'outline-item'
    item.dataset.line = String(heading.line)
    item.dataset.level = String(heading.level)

    // Indent based on heading level (H1 = 0px, H2 = 16px, etc.)
    item.style.paddingLeft = `${(heading.level - 1) * 16 + 8}px`

    const label = document.createElement('span')
    label.className = 'outline-label'
    label.textContent = heading.text

    item.appendChild(label)

    item.addEventListener('click', () => {
      if (onHeadingClickCb) {
        onHeadingClickCb(heading.line)
      }
      highlightHeading(heading.line)
    })

    content.appendChild(item)
  }

  // Restore active heading highlight if still valid
  if (activeHeadingLine !== null) {
    highlightHeading(activeHeadingLine)
  }
}

export function highlightHeading(line: number): void {
  activeHeadingLine = line
  const content = document.getElementById('outline-content')
  if (!content) return

  content.querySelectorAll('.outline-item-active').forEach((el) => {
    el.classList.remove('outline-item-active')
  })

  // Find the closest heading at or before the given line
  let closest: Heading | null = null
  for (const h of currentHeadings) {
    if (h.line <= line) {
      closest = h
    } else {
      break
    }
  }

  if (closest) {
    const items = content.querySelectorAll('.outline-item')
    items.forEach((item) => {
      const el = item as HTMLElement
      if (el.dataset.line === String(closest!.line)) {
        el.classList.add('outline-item-active')
        // Scroll the outline item into view if needed
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
  }
}
