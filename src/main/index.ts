import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { registerIpcHandlers, setMainWindow } from './ipc/registerIpcHandlers'
import { ptyManager } from './pty/ptyManager'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = resolve(__dirname, '../..')

export const MAIN_DIST = resolve(process.env.APP_ROOT, 'out/main')
export const RENDERER_DIST = resolve(process.env.APP_ROOT, 'out/renderer')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? resolve(process.env.APP_ROOT, 'src/renderer/public')
  : RENDERER_DIST

let win: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: '#0a0a0a',
    title: 'AI Terminal Studio',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    win?.show()
  })

  setMainWindow(win)
  registerIpcHandlers()

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    await win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(resolve(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  ptyManager.disposeAll()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
