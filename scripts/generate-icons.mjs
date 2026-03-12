import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const svgPath = join(projectRoot, 'resources', 'icon.svg')
const iconsetDir = join(projectRoot, 'resources', 'icon.iconset')

mkdirSync(iconsetDir, { recursive: true })

const svgBuffer = readFileSync(svgPath)

// macOS iconset sizes: [filename, size]
const iconsetSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

console.log('Generating iconset PNGs...')
for (const [filename, size] of iconsetSizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(iconsetDir, filename))
  console.log(`  Created ${filename} (${size}x${size})`)
}

// Linux icon: 512x512 PNG
console.log('Generating Linux icon (512x512)...')
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(join(projectRoot, 'resources', 'icon.png'))
console.log('  Created resources/icon.png')

console.log('Done. Now run: iconutil -c icns resources/icon.iconset -o resources/icon.icns')
