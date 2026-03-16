/**
 * Formatting toolbar component for SimpleMD.
 * Maps toolbar button clicks to editor formatting actions.
 * Handles viewer/edit mode toggling by showing/hiding the appropriate controls.
 */

let actionCallback: ((action: string) => void) | null = null
let modeToggleCallback: (() => void) | null = null

export function initToolbar(
  onAction: (action: string) => void,
  onModeToggle: () => void,
): void {
  actionCallback = onAction
  modeToggleCallback = onModeToggle

  const toolbar = document.getElementById('toolbar')
  if (!toolbar) return

  // Wire format action buttons
  const buttons = toolbar.querySelectorAll<HTMLButtonElement>('button[data-action]')

  buttons.forEach((btn) => {
    const action = btn.dataset.action
    if (!action) return

    btn.addEventListener('click', () => {
      if (actionCallback) {
        actionCallback(action)
      }
      // Brief active-state flash for feedback
      btn.classList.add('toolbar-btn-active')
      setTimeout(() => btn.classList.remove('toolbar-btn-active'), 150)
    })

    // Prevent stealing focus from editor
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })
  })

  // Wire mode toggle buttons
  const editBtn = document.getElementById('toolbar-edit-btn')
  const viewBtn = document.getElementById('toolbar-view-btn')

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (modeToggleCallback) modeToggleCallback()
    })
    editBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })
  }

  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      if (modeToggleCallback) modeToggleCallback()
    })
    viewBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })
  }
}

/**
 * Update the toolbar to reflect viewer or edit mode.
 * In viewer mode: show the "Edit" button, hide format buttons and "View" button.
 * In edit mode: show format buttons and "View" button, hide "Edit" button.
 */
export function setToolbarMode(isViewer: boolean, isCodeMode = false): void {
  const toolbar = document.getElementById('toolbar')
  const editBtn = document.getElementById('toolbar-edit-btn')
  const viewBtn = document.getElementById('toolbar-view-btn')
  const formatGroup = document.getElementById('toolbar-format-buttons')
  const modeToggle = document.querySelector('.toolbar-mode-toggle') as HTMLElement

  if (!editBtn || !viewBtn || !formatGroup) return

  if (isCodeMode) {
    // Code mode: hide all markdown-specific toolbar items
    formatGroup.style.display = 'none'
    editBtn.style.display = 'none'
    viewBtn.style.display = 'none'
    if (modeToggle) modeToggle.style.display = 'none'
    toolbar?.classList.remove('toolbar--viewer')
  } else if (isViewer) {
    // Viewer mode: prominent "Edit" button, hide format buttons and "View" button
    editBtn.style.display = ''
    formatGroup.style.display = 'none'
    viewBtn.style.display = 'none'
    if (modeToggle) modeToggle.style.display = ''
    toolbar?.classList.add('toolbar--viewer')
  } else {
    // Edit mode: show format buttons and "View" button, hide "Edit" button
    editBtn.style.display = 'none'
    formatGroup.style.display = ''
    viewBtn.style.display = ''
    if (modeToggle) modeToggle.style.display = ''
    toolbar?.classList.remove('toolbar--viewer')
  }
}
