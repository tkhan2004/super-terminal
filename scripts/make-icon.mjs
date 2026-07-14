/**
 * Converts logo-super-terminal.jpg → build/icons/icon.ico (Windows)
 * and build/icons/icon.png (for taskbar / About dialog)
 */
import { Jimp } from 'jimp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC  = resolve('C:/KhangNT-New/logo-super-terminal.jpg')
const OUT  = resolve(ROOT, 'build/icons')

mkdirSync(OUT, { recursive: true })

// Sizes required for a proper Windows .ico
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

console.log('Reading source image…')
const img = await Jimp.read(SRC)

// Save high-res PNG for electron's About box / taskbar
const png256 = img.clone().resize({ w: 256, h: 256 })
const pngBuf = await png256.getBuffer('image/png')
writeFileSync(resolve(OUT, 'icon.png'), pngBuf)
console.log('✓ icon.png (256×256)')

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
console.log('\nDone! Icons saved to build/icons/')
