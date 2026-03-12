#!/usr/bin/env node
'use strict'

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PKG = require(path.resolve(__dirname, '..', 'package.json'))
const APP_NAME = 'simplemd'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElectronBin() {
  try {
    return require('electron')
  } catch {
    return process.platform === 'win32' ? 'electron.cmd' : 'electron'
  }
}

function getAppEntry() {
  const distEntry = path.resolve(__dirname, '..', 'dist', 'main', 'index.js')
  if (fs.existsSync(distEntry)) return distEntry
  return path.resolve(__dirname, '..')
}

// ---------------------------------------------------------------------------
// Help & version
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`SimpleMD - Markdown editor for humans and agents

Usage:
  ${APP_NAME} [file]           Open file in edit mode
  ${APP_NAME} view <file>      Open file in read-only mode
  ${APP_NAME} edit <file>      Open file in edit mode
  ${APP_NAME} diff <file>      Open diff file with highlighting
  cat file | ${APP_NAME}       Open piped content
  git diff | ${APP_NAME}       View diff from stdin

Options:
  -h, --help     Show help
  -v, --version  Show version
  --view         Open in viewer mode
  --line <n>     Jump to line number
  --theme <name> Set theme (github, dracula, nord, etc.)
  --json         Output file metadata as JSON (no GUI)

Examples:
  ${APP_NAME} README.md
  git diff HEAD~1 | ${APP_NAME}
  ${APP_NAME} view report.md
  ${APP_NAME} --theme dracula notes.md
  ${APP_NAME} --json README.md
  ${APP_NAME} --line 42 main.ts`)
}

function printVersion() {
  console.log(`${APP_NAME} ${PKG.version}`)
}

// ---------------------------------------------------------------------------
// --json mode: output file metadata to stdout and exit
// ---------------------------------------------------------------------------

function outputJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const words = content.split(/\s+/).filter(Boolean).length
  const chars = content.length
  const headings = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/)
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), line: i + 1 })
    }
  }
  const links = []
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g
  let m
  while ((m = linkRe.exec(content)) !== null) {
    links.push({ text: m[1], url: m[2] })
  }
  const codeBlocks = (content.match(/^```/gm) || []).length / 2 | 0

  const meta = {
    file: filePath,
    bytes: Buffer.byteLength(content, 'utf-8'),
    lines: lines.length,
    words,
    chars,
    headings,
    links: links.length,
    codeBlocks,
  }
  console.log(JSON.stringify(meta, null, 2))
}

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

function resolveFilePath(filePath) {
  if (!filePath) return null
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) {
    console.error(`${APP_NAME}: file not found: ${filePath}`)
    process.exit(1)
  }
  return abs
}

// ---------------------------------------------------------------------------
// Stdin pipe support
// ---------------------------------------------------------------------------

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => { data += chunk })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Launch Electron
// ---------------------------------------------------------------------------

function launch(opts) {
  const electronBin = getElectronBin()
  const appEntry = getAppEntry()
  const electronArgs = [appEntry]

  if (opts.filePath) electronArgs.push('--md-file', opts.filePath)
  if (opts.mode)     electronArgs.push('--md-mode', opts.mode)
  if (opts.line)     electronArgs.push('--md-line', String(opts.line))
  if (opts.theme)    electronArgs.push('--md-theme', opts.theme)
  if (opts.stdin)    electronArgs.push('--md-stdin', opts.stdin)

  const child = spawn(electronBin, electronArgs, {
    stdio: 'inherit',
    detached: true,
  })

  child.on('error', (err) => {
    console.error(`${APP_NAME}: failed to launch Electron: ${err.message}`)
    process.exit(1)
  })

  child.unref()
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2)

  // Flags
  let mode = 'edit'
  let rawFile = null
  let line = null
  let theme = null
  let jsonMode = false
  let viewFlag = false

  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0) }
    if (arg === '--version' || arg === '-v') { printVersion(); process.exit(0) }
    if (arg === '--json') { jsonMode = true; continue }
    if (arg === '--view') { viewFlag = true; continue }
    if (arg === '--line' && argv[i + 1]) { line = parseInt(argv[++i], 10); continue }
    if (arg === '--theme' && argv[i + 1]) { theme = argv[++i]; continue }
    positional.push(arg)
  }

  // Subcommands
  const sub = positional[0]
  if (sub === 'view') {
    mode = 'view'
    rawFile = positional[1] || null
  } else if (sub === 'edit') {
    mode = 'edit'
    rawFile = positional[1] || null
  } else if (sub === 'diff') {
    mode = 'view'
    rawFile = positional[1] || null
  } else if (sub) {
    rawFile = sub
  }

  if (viewFlag) mode = 'view'

  // Auto-detect diff/patch files
  if (rawFile && (rawFile.endsWith('.diff') || rawFile.endsWith('.patch'))) {
    mode = 'view'
  }

  // --json mode: print metadata and exit
  if (jsonMode) {
    if (!rawFile) {
      console.error(`${APP_NAME}: --json requires a file argument`)
      process.exit(1)
    }
    const filePath = resolveFilePath(rawFile)
    outputJson(filePath)
    process.exit(0)
  }

  // Check for stdin pipe (not a TTY, and no file specified)
  const isPiped = !process.stdin.isTTY
  if (isPiped) {
    const stdinContent = await readStdin()
    if (stdinContent.length > 0) {
      // Auto-detect diff content from stdin
      if (stdinContent.startsWith('diff --git ') || stdinContent.startsWith('--- ')) {
        mode = 'view'
      }
      launch({ mode, stdin: stdinContent, line, theme })
      return
    }
  }

  // No file and no stdin: show help
  if (!rawFile) {
    printHelp()
    process.exit(0)
  }

  const filePath = resolveFilePath(rawFile)
  launch({ filePath, mode, line, theme })
}

main().catch((err) => {
  console.error(`${APP_NAME}: ${err.message}`)
  process.exit(1)
})
