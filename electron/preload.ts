import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('simplemd', {
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (data: { filePath: string | null; content: string }) =>
      ipcRenderer.invoke('file:save', data),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    readDir: (dirPath: string) => ipcRenderer.invoke('file:readDir', dirPath),
    openFolder: () => ipcRenderer.invoke('file:openFolder'),
  },
  export: {
    html: (data: { html: string; filePath: string }) =>
      ipcRenderer.invoke('export:html', data),
    pdf: () => ipcRenderer.invoke('export:pdf'),
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'menu:new', 'menu:open', 'menu:openFolder', 'menu:save', 'menu:saveAs',
      'menu:exportPdf', 'menu:exportHtml',
      'menu:bold', 'menu:italic', 'menu:strikethrough', 'menu:code',
      'menu:heading1', 'menu:heading2', 'menu:heading3',
      'menu:bulletList', 'menu:orderedList', 'menu:taskList',
      'menu:blockquote', 'menu:horizontalRule', 'menu:table',
      'menu:link', 'menu:image', 'menu:codeBlock',
      'menu:toggleSidebar', 'menu:toggleOutline', 'menu:toggleViewerMode',
      'menu:focusMode', 'menu:typewriterMode',
      'menu:find', 'menu:replace',
      'theme:change',
      'file:openFromMain',
    ]
    if (validChannels.includes(channel)) {
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
      ipcRenderer.on(channel, handler)
      // Return a cleanup function to remove the listener
      return () => ipcRenderer.removeListener(channel, handler)
    }
    return () => {}
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
})
