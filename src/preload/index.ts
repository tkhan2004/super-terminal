import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcInvokeChannel,
  IpcInvokeArgs,
  IpcInvokeResult
} from '@shared/types/ipc'

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
      layout: import('@shared/types/workspace').WorkspaceLayout
    ) => invoke('workspace:saveState', workspace, sessions, layout),
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
  }
}

export type TerminalApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API via contextBridge:', error)
  }
} else {
  // @ts-ignore - window.api assignment in non-isolated context
  window.api = api
}
