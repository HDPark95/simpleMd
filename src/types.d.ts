interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface FileData {
  filePath: string
  content: string
}

interface SimpleMDAPI {
  file: {
    open: () => Promise<FileData | null>
    save: (data: { filePath: string | null; content: string }) => Promise<string | null>
    read: (filePath: string) => Promise<string | null>
    readDir: (dirPath: string) => Promise<FileEntry[]>
    openFolder: () => Promise<string | null>
  }
  export: {
    html: (data: { html: string; filePath: string }) => Promise<boolean>
    pdf: () => Promise<boolean>
  }
  on: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    simplemd: SimpleMDAPI
  }
}

export {}
