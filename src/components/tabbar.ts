/**
 * Tab bar component for SimpleMD.
 * Manages multiple open documents as browser-style tabs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabState {
  id: number
  filePath: string | null
  title: string
  content: string
  isModified: boolean
  scrollTop: number
  isViewerMode: boolean
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let nextTabId = 1
let tabs: TabState[] = []
let activeTabId: number | null = null
let closedTabs: (TabState & { index: number })[] = []
const MAX_CLOSED_TABS = 20

// Callbacks
let onTabActivate: ((tab: TabState) => void) | null = null
let onTabCreate: ((tab: TabState) => void) | null = null
let onTabClose: ((tab: TabState) => Promise<boolean>) | null = null
let onTabSaveState: (() => Partial<TabState>) | null = null

// Drag state
let draggedTabId: number | null = null
let dropTargetTabId: number | null = null
let dropTargetAfter = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTabLabel(tab: TabState): string {
  if (tab.filePath) {
    return tab.filePath.split('/').pop() || 'Untitled'
  }
  return tab.title || 'Untitled'
}

function findTabByFile(filePath: string): TabState | undefined {
  return tabs.find(t => t.filePath === filePath)
}

function getActiveTab(): TabState | undefined {
  return tabs.find(t => t.id === activeTabId)
}

// ---------------------------------------------------------------------------
// Tab operations
// ---------------------------------------------------------------------------

function createTab(state: Partial<TabState> = {}): TabState {
  const tab: TabState = {
    id: nextTabId++,
    filePath: state.filePath ?? null,
    title: state.title ?? 'Untitled',
    content: state.content ?? '',
    isModified: state.isModified ?? false,
    scrollTop: state.scrollTop ?? 0,
    isViewerMode: state.isViewerMode ?? false,
  }
  tabs.push(tab)
  return tab
}

function saveCurrentTabState(): void {
  if (!activeTabId || !onTabSaveState) return
  const current = getActiveTab()
  if (!current) return
  const state = onTabSaveState()
  Object.assign(current, state)
}

function activateTab(tabId: number): void {
  if (activeTabId === tabId) return

  // Save current tab state first
  saveCurrentTabState()

  activeTabId = tabId
  const tab = getActiveTab()
  if (tab && onTabActivate) {
    onTabActivate(tab)
  }
  renderTabBar()
}

function removeTab(tabId: number): void {
  const idx = tabs.findIndex(t => t.id === tabId)
  if (idx === -1) return

  const tab = tabs[idx]

  // Remember for reopen
  closedTabs.push({ ...tab, index: idx })
  if (closedTabs.length > MAX_CLOSED_TABS) closedTabs.shift()

  tabs.splice(idx, 1)

  // If we closed the active tab, switch to adjacent
  if (activeTabId === tabId) {
    if (tabs.length === 0) {
      // Create new blank tab
      const blank = createTab()
      activeTabId = blank.id
      if (onTabCreate) onTabCreate(blank)
    } else {
      const newIdx = Math.min(idx, tabs.length - 1)
      activeTabId = tabs[newIdx].id
      const newTab = tabs[newIdx]
      if (onTabActivate) onTabActivate(newTab)
    }
  }

  renderTabBar()
}

function moveTab(fromId: number, toId: number, after: boolean): void {
  const fromIdx = tabs.findIndex(t => t.id === fromId)
  const toIdx = tabs.findIndex(t => t.id === toId)
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

  const [tab] = tabs.splice(fromIdx, 1)
  let insertIdx = toIdx
  if (fromIdx < toIdx) insertIdx--
  if (after) insertIdx++
  tabs.splice(insertIdx, 0, tab)
  renderTabBar()
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

function showContextMenu(tabId: number, x: number, y: number): void {
  // Remove existing menu
  document.querySelector('.tab-context-menu')?.remove()

  const menu = document.createElement('div')
  menu.className = 'tab-context-menu'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`

  const tabIdx = tabs.findIndex(t => t.id === tabId)

  const addItem = (label: string, action: () => void, disabled = false) => {
    const btn = document.createElement('button')
    btn.className = 'tab-context-menu-item'
    btn.textContent = label
    btn.disabled = disabled
    if (!disabled) {
      btn.addEventListener('click', () => {
        menu.remove()
        action()
      })
    }
    menu.appendChild(btn)
  }

  const addSep = () => {
    const sep = document.createElement('div')
    sep.className = 'tab-context-menu-sep'
    menu.appendChild(sep)
  }

  addItem('Reopen Closed Tab', () => reopenClosedTab(), closedTabs.length === 0)
  addSep()
  addItem('Close', () => closeTabWithConfirm(tabId))
  addItem('Close Others', () => closeOtherTabs(tabId), tabs.length <= 1)
  addItem('Close Tabs to Right', () => closeTabsToRight(tabId), tabIdx >= tabs.length - 1)

  document.body.appendChild(menu)

  // Close on click outside
  const closeMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove()
      document.removeEventListener('mousedown', closeMenu)
    }
  }
  setTimeout(() => document.addEventListener('mousedown', closeMenu), 0)
}

async function closeTabWithConfirm(tabId: number): Promise<void> {
  const tab = tabs.find(t => t.id === tabId)
  if (!tab) return

  if (tab.isModified && onTabClose) {
    const canClose = await onTabClose(tab)
    if (!canClose) return
  }

  removeTab(tabId)
}

async function closeOtherTabs(keepId: number): Promise<void> {
  const toClose = tabs.filter(t => t.id !== keepId)
  for (const tab of toClose) {
    if (tab.isModified && onTabClose) {
      const canClose = await onTabClose(tab)
      if (!canClose) continue
    }
    removeTab(tab.id)
  }
  activateTab(keepId)
}

async function closeTabsToRight(tabId: number): Promise<void> {
  const idx = tabs.findIndex(t => t.id === tabId)
  if (idx === -1) return
  const toClose = tabs.slice(idx + 1)
  for (const tab of [...toClose].reverse()) {
    if (tab.isModified && onTabClose) {
      const canClose = await onTabClose(tab)
      if (!canClose) continue
    }
    removeTab(tab.id)
  }
}

function reopenClosedTab(): void {
  if (closedTabs.length === 0) return
  const restored = closedTabs.pop()!
  const { index, ...tabState } = restored

  // Check if file already open
  if (tabState.filePath) {
    const existing = findTabByFile(tabState.filePath)
    if (existing) {
      activateTab(existing.id)
      return
    }
  }

  // Check if current tab is blank/disposable
  const current = getActiveTab()
  const isDisposable = current && !current.filePath && !current.isModified && current.content === ''

  if (isDisposable && current) {
    // Reuse blank tab
    Object.assign(current, { ...tabState, id: current.id })
    if (onTabActivate) onTabActivate(current)
    renderTabBar()
    return
  }

  // Insert at original index
  const tab = createTab(tabState)
  // Move from end to original position
  tabs.pop()
  const insertIdx = Math.min(index, tabs.length)
  tabs.splice(insertIdx, 0, tab)

  activateTab(tab.id)
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderTabBar(): void {
  const list = document.getElementById('tabbar-list')
  if (!list) return

  list.innerHTML = ''

  for (const tab of tabs) {
    const item = document.createElement('div')
    item.className = 'tabbar-tab'
    if (tab.id === activeTabId) item.classList.add('tabbar-tab--active')
    item.draggable = true

    // Main button area (click to activate)
    const main = document.createElement('button')
    main.className = 'tabbar-tab-main'
    main.title = tab.filePath || getTabLabel(tab)

    const titleSpan = document.createElement('span')
    titleSpan.className = 'tabbar-tab-title'
    titleSpan.textContent = getTabLabel(tab)
    main.appendChild(titleSpan)

    if (tab.isModified) {
      const dirty = document.createElement('span')
      dirty.className = 'tabbar-tab-dirty'
      dirty.textContent = '*'
      main.appendChild(dirty)
    }

    main.addEventListener('click', () => activateTab(tab.id))
    main.addEventListener('mousedown', (e) => e.preventDefault())

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.className = 'tabbar-tab-close'
    closeBtn.textContent = '\u00d7'
    closeBtn.title = `Close ${getTabLabel(tab)}`
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      closeTabWithConfirm(tab.id)
    })
    closeBtn.addEventListener('mousedown', (e) => e.preventDefault())

    item.appendChild(main)
    item.appendChild(closeBtn)

    // Context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      showContextMenu(tab.id, e.clientX, e.clientY)
    })

    // Drag handlers
    item.addEventListener('dragstart', (e) => {
      draggedTabId = tab.id
      dropTargetTabId = null
      dropTargetAfter = false
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', String(tab.id))
      item.classList.add('tabbar-tab--dragging')
    })

    item.addEventListener('dragover', (e) => {
      if (draggedTabId === null || draggedTabId === tab.id) return
      e.preventDefault()
      const rect = item.getBoundingClientRect()
      const placeAfter = e.clientX >= rect.left + rect.width / 2
      dropTargetTabId = tab.id
      dropTargetAfter = placeAfter

      // Update visual indicators
      list.querySelectorAll('.tabbar-tab').forEach(el => {
        el.classList.remove('tabbar-tab--drop-before', 'tabbar-tab--drop-after')
      })
      item.classList.add(placeAfter ? 'tabbar-tab--drop-after' : 'tabbar-tab--drop-before')
    })

    item.addEventListener('dragend', () => {
      if (draggedTabId !== null && dropTargetTabId !== null) {
        moveTab(draggedTabId, dropTargetTabId, dropTargetAfter)
      }
      draggedTabId = null
      dropTargetTabId = null
      dropTargetAfter = false
      list.querySelectorAll('.tabbar-tab').forEach(el => {
        el.classList.remove('tabbar-tab--dragging', 'tabbar-tab--drop-before', 'tabbar-tab--drop-after')
      })
    })

    list.appendChild(item)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TabBarCallbacks {
  /** Called when a tab is activated — restore its content in the editor */
  onActivate: (tab: TabState) => void
  /** Called when a new blank tab is created */
  onCreate: (tab: TabState) => void
  /** Called before closing a modified tab — return true to allow close */
  onClose: (tab: TabState) => Promise<boolean>
  /** Called to get current editor state for saving into the active tab */
  onSaveState: () => Partial<TabState>
}

export function initTabBar(callbacks: TabBarCallbacks): void {
  onTabActivate = callbacks.onActivate
  onTabCreate = callbacks.onCreate
  onTabClose = callbacks.onClose
  onTabSaveState = callbacks.onSaveState

  // New tab button
  const newBtn = document.getElementById('tabbar-new')
  if (newBtn) {
    newBtn.addEventListener('click', () => createBlankTab())
    newBtn.addEventListener('mousedown', (e) => e.preventDefault())
  }
}

export function createBlankTab(): TabState {
  saveCurrentTabState()
  const tab = createTab()
  activeTabId = tab.id
  if (onTabCreate) onTabCreate(tab)
  renderTabBar()
  return tab
}

/**
 * Open a file in a tab. If the file is already open, switch to that tab.
 * If the current tab is a disposable blank, reuse it.
 */
export function openFileInTab(filePath: string | null, content: string, viewerMode = false): TabState {
  // Save current state first
  saveCurrentTabState()

  // If file is already open in a tab, switch to it
  if (filePath) {
    const existing = findTabByFile(filePath)
    if (existing) {
      // Update content in case it changed
      existing.content = content
      existing.isViewerMode = viewerMode
      activateTab(existing.id)
      return existing
    }
  }

  // Check if current tab is disposable (blank welcome tab)
  const current = getActiveTab()
  const isDisposable = current && !current.filePath && !current.isModified &&
    (current.content === '' || current.title === 'Untitled' || current.content.startsWith('# Welcome to SimpleMD'))

  let tab: TabState
  if (isDisposable && current) {
    // Reuse current tab
    current.filePath = filePath
    current.content = content
    current.title = filePath ? filePath.split('/').pop() || 'Untitled' : 'Untitled'
    current.isModified = false
    current.scrollTop = 0
    current.isViewerMode = viewerMode
    tab = current
  } else {
    // Create new tab
    tab = createTab({
      filePath,
      content,
      title: filePath ? filePath.split('/').pop() || 'Untitled' : 'Untitled',
      isViewerMode: viewerMode,
    })
  }

  activeTabId = tab.id
  if (onTabActivate) onTabActivate(tab)
  renderTabBar()
  return tab
}

export function updateActiveTabState(updates: Partial<TabState>): void {
  const tab = getActiveTab()
  if (tab) {
    Object.assign(tab, updates)
    // Re-render if title or modified changed
    if ('isModified' in updates || 'filePath' in updates || 'title' in updates) {
      renderTabBar()
    }
  }
}

export function getActiveTabState(): TabState | undefined {
  return getActiveTab()
}

export function getAllTabs(): TabState[] {
  return [...tabs]
}

/** Handle keyboard shortcuts for tabs */
export function handleTabKeyboard(e: KeyboardEvent): boolean {
  const isMod = e.metaKey || e.ctrlKey

  if (!isMod) return false

  const key = e.key.toLowerCase()

  // Ctrl+Tab / Ctrl+Shift+Tab: navigate tabs
  if (key === 'tab' && tabs.length > 1) {
    e.preventDefault()
    const currentIdx = tabs.findIndex(t => t.id === activeTabId)
    const direction = e.shiftKey ? -1 : 1
    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length
    activateTab(tabs[nextIdx].id)
    return true
  }

  // Ctrl+Shift+T: reopen closed tab
  if (e.shiftKey && key === 't') {
    e.preventDefault()
    reopenClosedTab()
    return true
  }

  // Ctrl+T: new tab
  if (!e.shiftKey && key === 't') {
    e.preventDefault()
    createBlankTab()
    return true
  }

  // Ctrl+W: close current tab
  if (!e.shiftKey && key === 'w') {
    e.preventDefault()
    if (activeTabId) closeTabWithConfirm(activeTabId)
    return true
  }

  return false
}

export { closeTabWithConfirm, reopenClosedTab }
