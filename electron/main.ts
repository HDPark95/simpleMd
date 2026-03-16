import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { buildMenu } from './menu'

let mainWindow: BrowserWindow | null = null
let pendingOpenFile: string | null = null
let currentWatcher: fs.FSWatcher | null = null

// ----- Single instance lock -----
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Another instance tried to launch — find the file arg and open it in existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      // Find file path in argv (skip electron binary and app path)
      const fileArg = argv.find(arg => {
        const lower = arg.toLowerCase()
        return (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt') ||
                lower.endsWith('.sql') || lower.endsWith('.json') || lower.endsWith('.yaml') ||
                lower.endsWith('.yml') || lower.endsWith('.js') || lower.endsWith('.ts') ||
                lower.endsWith('.py') || lower.endsWith('.html') || lower.endsWith('.css') ||
                lower.endsWith('.diff') || lower.endsWith('.patch') ||
                arg.startsWith('--md-file')) && !arg.startsWith('-')
      })

      const mdFileIdx = argv.indexOf('--md-file')
      const filePath = mdFileIdx !== -1 && argv[mdFileIdx + 1]
        ? argv[mdFileIdx + 1]
        : fileArg

      if (filePath && fs.existsSync(filePath)) {
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)
        const content = fs.readFileSync(absPath, 'utf-8')
        const isDiff = absPath.endsWith('.diff') || absPath.endsWith('.patch') || content.startsWith('diff --git ')
        mainWindow.webContents.send('file:openFromMain', {
          filePath: absPath,
          content,
          mode: isDiff ? 'view' : 'edit',
        })
        watchFile(absPath)
      }
    }
  })
}

function watchFile(filePath: string): void {
  // Stop previous watcher
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }

  try {
    currentWatcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change' && mainWindow) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          mainWindow.webContents.send('file:changed', { filePath, content })
        } catch { /* file might be temporarily unavailable */ }
      }
    })
  } catch { /* ignore watch errors */ }
}

function createWindow() {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    icon: isMac
      ? path.join(__dirname, '../../resources/icon.icns')
      : process.platform === 'win32'
        ? path.join(__dirname, '../../resources/icon.ico')
        : path.join(__dirname, '../../resources/icon.png'),
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 16 } }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false,
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()

    // Open file from command line argument.
    // The CLI (bin/simplemd.js) passes:
    //   --md-file <path>    the file to open
    //   --md-mode <mode>    "view" | "edit" (defaults to "edit")
    //   --md-line <n>       jump to line number
    //   --md-theme <name>   set theme on open
    //   --md-stdin <text>   content piped via stdin
    // For backwards compatibility we also accept a bare .md/.markdown/.txt arg.
    const argv = process.argv

    let fileArg: string | undefined
    let viewMode: 'view' | 'edit' = 'edit'
    let lineNumber: number | undefined
    let themeName: string | undefined
    let stdinContent: string | undefined

    const mdFileIdx = argv.indexOf('--md-file')
    if (mdFileIdx !== -1 && argv[mdFileIdx + 1]) {
      fileArg = argv[mdFileIdx + 1]
    } else {
      // Legacy: bare file path anywhere in argv
      fileArg = argv.find(arg => {
        if (arg.startsWith('-')) return false
        const lower = arg.toLowerCase()
        const ext = lower.slice(lower.lastIndexOf('.'))
        const supported = ['.md','.markdown','.txt','.sql','.json','.yaml','.yml','.toml','.xml',
          '.js','.ts','.jsx','.tsx','.py','.html','.css','.scss','.sh','.bash',
          '.java','.go','.rs','.c','.cpp','.h','.rb','.php','.swift','.diff','.patch','.log','.env','.conf']
        return supported.includes(ext)
      })
    }

    const mdModeIdx = argv.indexOf('--md-mode')
    if (mdModeIdx !== -1 && argv[mdModeIdx + 1] === 'view') {
      viewMode = 'view'
    }

    const mdLineIdx = argv.indexOf('--md-line')
    if (mdLineIdx !== -1 && argv[mdLineIdx + 1]) {
      lineNumber = parseInt(argv[mdLineIdx + 1], 10)
    }

    const mdThemeIdx = argv.indexOf('--md-theme')
    if (mdThemeIdx !== -1 && argv[mdThemeIdx + 1]) {
      themeName = argv[mdThemeIdx + 1]
    }

    const mdStdinIdx = argv.indexOf('--md-stdin')
    if (mdStdinIdx !== -1 && argv[mdStdinIdx + 1]) {
      stdinContent = argv[mdStdinIdx + 1]
    }

    // Auto-detect diff/patch files and open them in viewer mode
    if (fileArg && (fileArg.endsWith('.diff') || fileArg.endsWith('.patch'))) {
      viewMode = 'view'
    }

    // Check for pending open-file event (macOS Finder double-click before window ready)
    if (pendingOpenFile) {
      fileArg = pendingOpenFile
      pendingOpenFile = null
    }

    // Apply theme if specified via CLI
    if (themeName) {
      mainWindow?.webContents.send('theme:change', themeName)
    }

    // Handle stdin piped content
    if (stdinContent) {
      // Auto-detect diff content
      if (stdinContent.startsWith('diff --git ') || stdinContent.startsWith('--- ')) {
        viewMode = 'view'
      }
      mainWindow?.webContents.send('file:openFromMain', {
        filePath: null,
        content: stdinContent,
        mode: viewMode,
        line: lineNumber,
      })
    } else if (fileArg) {
      const absPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(fileArg)
      if (fs.existsSync(absPath)) {
        const content = fs.readFileSync(absPath, 'utf-8')
        // Auto-detect diff content even for non-.diff/.patch files
        if (viewMode !== 'view' && content.startsWith('diff --git ')) {
          viewMode = 'view'
        }
        mainWindow?.webContents.send('file:openFromMain', {
          filePath: absPath,
          content,
          mode: viewMode,
          line: lineNumber,
        })
        watchFile(absPath)
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const menu = buildMenu(mainWindow)
  Menu.setApplicationMenu(menu)
}

// IPC: Open file
ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'Code', extensions: ['sql', 'js', 'ts', 'py', 'json', 'yaml', 'yml', 'html', 'css', 'sh'] },
      { name: 'Diff / Patch', extensions: ['diff', 'patch'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  watchFile(filePath)
  return { filePath, content }
})

// IPC: Save file
ipcMain.handle('file:save', async (_event, data: { filePath: string | null; content: string }) => {
  let savePath = data.filePath

  if (!savePath) {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return null
    savePath = result.filePath
  }

  fs.writeFileSync(savePath, data.content, 'utf-8')
  return savePath
})

// IPC: Read directory
ipcMain.handle('file:readDir', async (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
})

// IPC: Read file
ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
})

// IPC: Open folder
ipcMain.handle('file:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// IPC: Export to HTML
ipcMain.handle('export:html', async (_event, data: { html: string; filePath: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: data.filePath?.replace(/\.md$/, '.html'),
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (result.canceled || !result.filePath) return false
  fs.writeFileSync(result.filePath, data.html, 'utf-8')
  return true
})

// IPC: Export to PDF
ipcMain.handle('export:pdf', async () => {
  if (!mainWindow) return false
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return false

  const pdfData = await mainWindow.webContents.printToPDF({
    printBackground: true,
    margins: {
      marginType: 'custom',
      top: 25400,    // 1 inch in microns
      bottom: 25400,
      left: 25400,
      right: 25400,
    },
  })
  fs.writeFileSync(result.filePath, pdfData)
  return true
})

// macOS: handle file open from Finder (double-click any supported file)
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWindow && mainWindow.webContents) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const isDiff = filePath.endsWith('.diff') || filePath.endsWith('.patch') || content.startsWith('diff --git ')
    mainWindow.webContents.send('file:openFromMain', { filePath, content, mode: isDiff ? 'view' : 'edit' })
    watchFile(filePath)
  } else {
    // App not ready yet — store path and open after window is created
    pendingOpenFile = filePath
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
