import chokidar from 'chokidar'
import { EventEmitter } from 'node:events'
import { relative } from 'node:path'

export interface FileWatcherEvents {
  add: (path: string) => void
  unlink: (path: string) => void
  change: (path: string) => void
  addDir: (path: string) => void
  unlinkDir: (path: string) => void
  ready: () => void
}

const IGNORED = ['node_modules', '.git', 'dist', 'build', 'out', 'release', '.next', 'coverage']

export class FileWatcher extends EventEmitter {
  private watchers = new Map<string, chokidar.FSWatcher>()
  private readyWatchers = new Set<string>()

  watch(rootPath: string, watchId: string): void {
    if (this.watchers.has(watchId)) return

    const watcher = chokidar.watch(rootPath, {
      ignored: IGNORED.map((dir) => `**/${dir}/**`),
      persistent: true,
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    watcher
      .on('add', (path) => this.emit('add', relative(rootPath, path)))
      .on('change', (path) => this.emit('change', relative(rootPath, path)))
      .on('unlink', (path) => this.emit('unlink', relative(rootPath, path)))
      .on('addDir', (path) => this.emit('addDir', relative(rootPath, path)))
      .on('unlinkDir', (path) => this.emit('unlinkDir', relative(rootPath, path)))
      .on('ready', () => {
        this.readyWatchers.add(watchId)
        this.emit('ready')
      })

    this.watchers.set(watchId, watcher)
  }

  stop(watchId: string): void {
    const watcher = this.watchers.get(watchId)
    if (watcher) {
      watcher.close()
      this.watchers.delete(watchId)
      this.readyWatchers.delete(watchId)
    }
  }

  stopAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    this.readyWatchers.clear()
  }

  isReady(watchId: string): boolean {
    return this.readyWatchers.has(watchId)
  }
}

export const fileWatcher = new FileWatcher()
