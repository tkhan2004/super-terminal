/**
 * Converts source image → build/icons/icon.ico (Windows)
 * and build/icons/icon.png (for taskbar / About dialog)
 * and build/icons/icon.icns (macOS)
 */
import { Jimp } from 'jimp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT  = resolve(ROOT, 'build/icons')

// Resolve source path dynamically: CLI argument > local icon.png fallback > default hardcoded path
let srcPath = process.argv[2]
  ? resolve(process.argv[2])
  : null

if (!srcPath) {
  const fallbackPng = resolve(OUT, 'icon.png')
  if (existsSync(fallbackPng)) {
    srcPath = fallbackPng
  } else {
    srcPath = resolve('C:/KhangNT-New/logo-super-terminal.jpg')
  }
}

mkdirSync(OUT, { recursive: true })

// Sizes required for a proper Windows .ico
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

console.log(`Reading source image from: ${srcPath}…`)
if (!existsSync(srcPath)) {
  console.error(`Error: Source image not found at ${srcPath}`)
  process.exit(1)
}

const img = await Jimp.read(srcPath)

// Save high-res PNG for electron's About box / taskbar (only if we are not reading from icon.png already)
if (srcPath !== resolve(OUT, 'icon.png')) {
  const png256 = img.clone().resize({ w: 256, h: 256 })
  const pngBuf = await png256.getBuffer('image/png')
  writeFileSync(resolve(OUT, 'icon.png'), pngBuf)
  console.log('✓ icon.png (256×256)')
}

// Generate each size as PNG buffer then bundle into .ico
const pngBuffers = []
for (const size of ICO_SIZES) {
  const resized = img.clone().resize({ w: size, h: size })
  const buf = await resized.getBuffer('image/png')
  pngBuffers.push(buf)
  console.log(`  → ${size}×${size} OK`)
}

const icoBuf = await pngToIco(pngBuffers)
writeFileSync(resolve(OUT, 'icon.ico'), icoBuf)
console.log('✓ icon.ico')

// If we are on macOS, generate .icns using iconutil
if (process.platform === 'darwin') {
  console.log('\nGenerating icon.icns (macOS)...')
  const iconsetDir = resolve(OUT, 'icon.iconset')
  mkdirSync(iconsetDir, { recursive: true })

  const ICNS_CONFIG = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
  ]

  try {
    for (const item of ICNS_CONFIG) {
      const resized = img.clone().resize({ w: item.size, h: item.size })
      const buf = await resized.getBuffer('image/png')
      writeFileSync(resolve(iconsetDir, item.name), buf)
    }
    console.log('  → Generated .iconset raw PNGs')

    // Call iconutil
    execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(OUT, 'icon.icns')}"`)
    console.log('✓ icon.icns')
  } catch (err) {
    console.error('Failed to create icon.icns:', err)
  } finally {
    try {
      rmSync(iconsetDir, { recursive: true, force: true })
    } catch {}
  }
} else {
  console.log('\nSkipping icon.icns generation (not on macOS)')
}

console.log('\nDone! Icons saved to build/icons/')
