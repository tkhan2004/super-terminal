import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcInvokeChannel,
  IpcInvokeArgs,
  IpcInvokeResult
} from '@shared/types/ipc'

console.log('[Preload] Preload script is executing!')

function invoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcInvokeResult<C>>
}

export interface SessionDataEvent {
  sessionId: string
  data: string
}

export interface SessionExitEvent {
  sessionId: string
  exitCode: number
}

const api = {
  invoke,

  workspace: {
    list: () => invoke('workspace:list'),
    create: (name: string, rootPath: string) => invoke('workspace:create', { name, rootPath }),
    open: (id: string) => invoke('workspace:open', id),
    close: (id: string) => invoke('workspace:close', id),
    selectFolder: () => invoke('workspace:selectFolder'),
    getState: (id: string) => invoke('workspace:getState', id),
    saveState: (
      workspace: import('@shared/types/workspace').Workspace,
      sessions: import('@shared/types/session').Session[],
      layout: import('@shared/types/workspace').WorkspaceLayout,
      tasks?: import('@shared/types/task').Task[],
      pinnedFiles?: string[],
      timeline?: Record<string, import('@shared/types/session').TimelineEvent[]>
    ) => invoke('workspace:saveState', workspace, sessions, layout, tasks, pinnedFiles, timeline),
    restore: (id: string) => invoke('workspace:restore', id)
  },

  session: {
    create: (opts: import('@shared/types/session').CreateSessionOptions) =>
      invoke('session:create', opts),
    write: (sessionId: string, data: string) => invoke('session:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      invoke('session:resize', sessionId, cols, rows),
    kill: (sessionId: string) => invoke('session:kill', sessionId),
    onData: (callback: (event: SessionDataEvent) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: SessionDataEvent): void =>
        callback(event)
      ipcRenderer.on('session:data', handler)
      return () => ipcRenderer.removeListener('session:data', handler)
    },
    onExit: (callback: (event: SessionExitEvent) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: SessionExitEvent): void =>
        callback(event)
      ipcRenderer.on('session:exit', handler)
      return () => ipcRenderer.removeListener('session:exit', handler)
    }
  },

  fs: {
    readDir: (path: string) => invoke('fs:readDir', path),
    listAllFiles: (path: string) => invoke('fs:listAllFiles', path),
    readFile: (path: string) => invoke('fs:readFile', path),
    watch: (rootPath: string) => invoke('fs:watch:subscribe', rootPath),
    unwatch: (watchId: string) => invoke('fs:watch:unsubscribe', watchId),
    onWatchEvent: (
      callback: (event: { watchId: string; type: string; path: string }) => void
    ): (() => void) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        event: { watchId: string; type: string; path: string }
      ): void => callback(event)
      ipcRenderer.on('fs:watch:event', handler)
      return () => ipcRenderer.removeListener('fs:watch:event', handler)
    }
  },

  git: {
    status: (cwd: string) => invoke('git:status', cwd),
    diff: (cwd: string, filePath?: string) => invoke('git:diff', cwd, filePath),
    log: (cwd: string, limit?: number) => invoke('git:log', cwd, limit),
    branches: (cwd: string) => invoke('git:branches', cwd),
    checkout: (cwd: string, branchName: string) => invoke('git:checkout', cwd, branchName),
    moveAsideAndCheckout: (cwd: string, branchName: string, conflictingFiles: string[]) =>
      invoke('git:moveAsideAndCheckout', cwd, branchName, conflictingFiles),
    showFiles: (cwd: string, commitHash: string) => invoke('git:showFiles', cwd, commitHash),
    commitDiff: (cwd: string, commitHash: string, filePath: string) =>
      invoke('git:commitDiff', cwd, commitHash, filePath),
    push: (cwd: string) => invoke('git:push', cwd)
  },
  claude: {
    getCredentials: () => invoke('claude:getCredentials'),
    getQuota: () => invoke('claude:getQuota')
  },
  commandcode: {
    getQuota: () => invoke('commandcode:getQuota')
  },
  antigravity: {
    getQuota: () => invoke('antigravity:getQuota')
  },
  quota: {
    scanLogins: () => invoke('quota:scanLogins')
  }
}

export type TerminalApi = typeof api

try {
  contextBridge.exposeInMainWorld('api', api)
  console.log('[Preload] API exposed successfully via contextBridge!')
} catch (error) {
  console.warn('[Preload] Failed to expose API via contextBridge, falling back to window assignment:', error)
  ;(window as unknown as { api: typeof api }).api = api
}
