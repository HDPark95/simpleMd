import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron'

export function buildMenu(win: BrowserWindow | null): Menu {
  const send = (channel: string) => () => win?.webContents.send(channel)

  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'SimpleMD',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: send('menu:new') },
        { label: 'Open File...', accelerator: 'CmdOrCtrl+O', click: send('menu:open') },
        { label: 'Open Folder...', accelerator: 'CmdOrCtrl+Shift+O', click: send('menu:openFolder') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: send('menu:save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu:saveAs') },
        { type: 'separator' },
        { label: 'Export as PDF...', accelerator: 'CmdOrCtrl+P', click: send('menu:exportPdf') },
        { label: 'Export as HTML...', click: send('menu:exportHtml') },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find...', accelerator: 'CmdOrCtrl+F', click: send('menu:find') },
        { label: 'Replace...', accelerator: 'CmdOrCtrl+H', click: send('menu:replace') },
      ]
    },
    {
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: send('menu:bold') },
        { label: 'Italic', accelerator: 'CmdOrCtrl+I', click: send('menu:italic') },
        { label: 'Strikethrough', accelerator: 'CmdOrCtrl+Shift+X', click: send('menu:strikethrough') },
        { label: 'Inline Code', accelerator: 'CmdOrCtrl+`', click: send('menu:code') },
        { type: 'separator' },
        { label: 'Heading 1', accelerator: 'CmdOrCtrl+1', click: send('menu:heading1') },
        { label: 'Heading 2', accelerator: 'CmdOrCtrl+2', click: send('menu:heading2') },
        { label: 'Heading 3', accelerator: 'CmdOrCtrl+3', click: send('menu:heading3') },
        { type: 'separator' },
        { label: 'Bullet List', click: send('menu:bulletList') },
        { label: 'Ordered List', click: send('menu:orderedList') },
        { label: 'Task List', click: send('menu:taskList') },
        { type: 'separator' },
        { label: 'Blockquote', click: send('menu:blockquote') },
        { label: 'Horizontal Rule', click: send('menu:horizontalRule') },
        { label: 'Table', click: send('menu:table') },
        { label: 'Code Block', click: send('menu:codeBlock') },
        { type: 'separator' },
        { label: 'Link', accelerator: 'CmdOrCtrl+K', click: send('menu:link') },
        { label: 'Image', click: send('menu:image') },
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Viewer Mode', accelerator: 'CmdOrCtrl+Shift+V', click: send('menu:toggleViewerMode') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: send('menu:toggleSidebar') },
        { label: 'Toggle Outline', accelerator: 'CmdOrCtrl+Shift+\\', click: send('menu:toggleOutline') },
        { type: 'separator' },
        { label: 'Focus Mode', click: send('menu:focusMode') },
        { label: 'Typewriter Mode', click: send('menu:typewriterMode') },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ]
    },
    {
      label: 'Theme',
      submenu: [
        { label: 'Light', click: () => win?.webContents.send('theme:change', 'light') },
        { label: 'Dark', click: () => win?.webContents.send('theme:change', 'dark') },
        { label: 'GitHub', click: () => win?.webContents.send('theme:change', 'github') },
        { type: 'separator' },
        { label: 'Dracula', click: () => win?.webContents.send('theme:change', 'dracula') },
        { label: 'Nord', click: () => win?.webContents.send('theme:change', 'nord') },
        { label: 'Solarized Light', click: () => win?.webContents.send('theme:change', 'solarized-light') },
        { label: 'Solarized Dark', click: () => win?.webContents.send('theme:change', 'solarized-dark') },
        { label: 'One Dark', click: () => win?.webContents.send('theme:change', 'one-dark') },
        { label: 'Monokai', click: () => win?.webContents.send('theme:change', 'monokai') },
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [{ role: 'close' as const }]),
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
