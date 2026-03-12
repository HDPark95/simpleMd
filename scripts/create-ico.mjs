/**
 * Creates a Windows .ico file from PNG buffers.
 * ICO format: header + directory entries + image data.
 * We include sizes: 16, 32, 48, 64, 128, 256.
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const svgBuffer = readFileSync(join(projectRoot, 'resources', 'icon.svg'))

const sizes = [16, 32, 48, 64, 128, 256]

console.log('Generating PNG buffers for ICO...')
const pngBuffers = []
for (const size of sizes) {
  const buf = await sharp(svgBuffer).resize(size, size).png().toBuffer()
  pngBuffers.push(buf)
  console.log(`  ${size}x${size}: ${buf.length} bytes`)
}

// ICO header: 6 bytes
// ICONDIR: reserved(2) + type(2) + count(2)
const count = sizes.length
const headerSize = 6
const dirEntrySize = 16 // per image
const dirSize = count * dirEntrySize
const headerAndDirSize = headerSize + dirSize

// Build directory and calculate offsets
let offset = headerAndDirSize
const dirEntries = []
for (let i = 0; i < count; i++) {
  const size = sizes[i]
  const pngBuf = pngBuffers[i]
  dirEntries.push({
    width: size >= 256 ? 0 : size,   // 0 means 256 in ICO spec
    height: size >= 256 ? 0 : size,
    colorCount: 0,
    reserved: 0,
    planes: 1,
    bitCount: 32,
    bytesInRes: pngBuf.length,
    imageOffset: offset,
  })
  offset += pngBuf.length
}

const totalSize = offset
const icoBuffer = Buffer.alloc(totalSize)

// Write ICONDIR header
icoBuffer.writeUInt16LE(0, 0)      // reserved
icoBuffer.writeUInt16LE(1, 2)      // type: 1 = ICO
icoBuffer.writeUInt16LE(count, 4)  // image count

// Write directory entries
for (let i = 0; i < count; i++) {
  const e = dirEntries[i]
  const base = headerSize + i * dirEntrySize
  icoBuffer.writeUInt8(e.width, base)
  icoBuffer.writeUInt8(e.height, base + 1)
  icoBuffer.writeUInt8(e.colorCount, base + 2)
  icoBuffer.writeUInt8(e.reserved, base + 3)
  icoBuffer.writeUInt16LE(e.planes, base + 4)
  icoBuffer.writeUInt16LE(e.bitCount, base + 6)
  icoBuffer.writeUInt32LE(e.bytesInRes, base + 8)
  icoBuffer.writeUInt32LE(e.imageOffset, base + 12)
}

// Write PNG data
for (let i = 0; i < count; i++) {
  pngBuffers[i].copy(icoBuffer, dirEntries[i].imageOffset)
}

const icoPath = join(projectRoot, 'resources', 'icon.ico')
writeFileSync(icoPath, icoBuffer)
console.log(`Created resources/icon.ico (${icoBuffer.length} bytes)`)
