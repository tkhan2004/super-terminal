import { ipcMain, BrowserWindow } from 'electron'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileWatcher } from './fileWatcher'
import type { DirEntry } from '@shared/types/ipc'

let mainWindow: BrowserWindow | null = null

export function setMainWindowForFs(win: BrowserWindow): void {
  mainWindow = win
}

export function registerFsHandlers(): void {
  ipcMain.handle('fs:readDir', handleReadDir)
  ipcMain.handle('fs:watch:subscribe', handleWatchSubscribe)
  ipcMain.handle('fs:watch:unsubscribe', handleWatchUnsubscribe)
}

const watchRoots = new Map<string, string>()

async function handleReadDir(_event: unknown, dirPath: string): Promise<DirEntry[]> {
  try {
    const entries = readdirSync(dirPath)
    return entries
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const fullPath = join(dirPath, name)
        const stat = statSync(fullPath)
        return {
          name,
          path: fullPath,
          isDirectory: stat.isDirectory()
        }
      })
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

async function handleWatchSubscribe(_event: unknown, rootPath: string): Promise<string> {
  const watchId = randomUUID()
  watchRoots.set(watchId, rootPath)
  fileWatcher.watch(rootPath, watchId)

  const win = mainWindow
  if (win) {
    fileWatcher.on('add', (path: string) => {
      win.webContents.send('fs:watch:event', { watchId, type: 'add', path })
    })
    fileWatcher.on('change', (path: string) => {
      win.webContents.send('fs:watch:event', { watchId, type: 'change', path })
    })
    fileWatcher.on('unlink', (path: string) => {
      win.webContents.send('fs:watch:event', { watchId, type: 'unlink', path })
    })
    fileWatcher.on('addDir', (path: string) => {
      win.webContents.send('fs:watch:event', { watchId, type: 'addDir', path })
    })
    fileWatcher.on('unlinkDir', (path: string) => {
      win.webContents.send('fs:watch:event', { watchId, type: 'unlinkDir', path })
    })
  }

  return watchId
}

async function handleWatchUnsubscribe(_event: unknown, watchId: string): Promise<void> {
  fileWatcher.stop(watchId)
  watchRoots.delete(watchId)
}
