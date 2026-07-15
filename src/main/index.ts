import { app, BrowserWindow, shell, dialog, Menu } from 'electron'
import { exec } from 'node:child_process'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { registerIpcHandlers, setMainWindow } from './ipc/registerIpcHandlers'
import { registerFsHandlers, setMainWindowForFs } from './fs/fsHandlers'
import { ptyManager } from './pty/ptyManager'
import { logger } from './logging/logger'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = resolve(__dirname, '../..')

export const MAIN_DIST = resolve(process.env.APP_ROOT, 'out/main')
export const RENDERER_DIST = resolve(process.env.APP_ROOT, 'out/renderer')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? resolve(process.env.APP_ROOT, 'src/renderer/public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
let splash: BrowserWindow | null = null

async function createSplashWindow(): Promise<void> {
  splash = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      sandbox: true
    }
  })

  if (VITE_DEV_SERVER_URL) {
    await splash.loadURL(`${VITE_DEV_SERVER_URL}/splash.html`)
  } else {
    await splash.loadFile(resolve(RENDERER_DIST, 'splash.html'))
  }
}

async function createWindow(): Promise<void> {
  logger.info('Initializing Splash Window...')
  await createSplashWindow()

  // Resolve macOS shell path env before registering handlers
  await fixMacPathEnv()

  logger.info('Initializing Main BrowserWindow...')
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
      preload: resolve(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    logger.info('MainWindow is ready to show. Displaying window...')
    if (splash) {
      splash.close()
      splash = null
    }
    win?.show()
    
    // Check for updates shortly after app shows
    setTimeout(setupAutoUpdater, 3000)
  })

  setMainWindow(win)
  setMainWindowForFs(win)
  registerIpcHandlers()
  registerFsHandlers()

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
  logger.info('All windows closed. Disposing PTY sessions and quitting...')
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

app.whenReady().then(() => {
  logger.info('Electron Application Ready. Spawning MainWindow...')
  setMainMenu()
  createWindow()
})

function setupAutoUpdater(): void {
  // Only run autoUpdater in production and not on macOS
  if (app.isPackaged && process.platform !== 'darwin') {
    autoUpdater.logger = logger
    
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('Update downloaded successfully, prompting user to restart')
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} of Super Terminal has been downloaded. Restart the application to apply the update?`,
        buttons: ['Restart Now', 'Update on Exit'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
    })

    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logger.error('Error running autoUpdater:', err)
    })
  } else {
    logger.info('AutoUpdater is disabled in development mode')
  }
}

function fixMacPathEnv(): Promise<void> {
  if (process.platform !== 'darwin') {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    logger.info('Resolving macOS user shell environment...')
    const shell = process.env.SHELL || '/bin/zsh'
    exec(`${shell} -ilc 'echo -n "___ENV___"; env'`, { encoding: 'utf8', timeout: 3000 }, (err, stdout) => {
      if (err || !stdout || !stdout.includes('___ENV___')) {
        logger.error('Failed to resolve macOS shell environment:', err || 'No delimiter found')
        resolve()
        return
      }
      try {
        const parts = stdout.split('___ENV___')
        const envStr = parts[1] || ''
        const lines = envStr.split('\n')
        for (const line of lines) {
          const index = line.indexOf('=')
          if (index > 0) {
            const key = line.substring(0, index)
            const val = line.substring(index + 1).trim()
            if (key) {
              process.env[key] = val
            }
          }
        }
        logger.info('Successfully merged macOS shell environment into process.env')
      } catch (e) {
        logger.error('Error parsing macOS shell environment:', e)
      }
      resolve()
    })
  })
}

function setMainMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: any[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
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
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [{ role: 'close' }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

