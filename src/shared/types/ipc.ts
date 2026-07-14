import type { Workspace, WorkspaceLayout } from './workspace'
import type { Session, CreateSessionOptions } from './session'

export interface IpcChannels {
  'workspace:list': { args: []; result: Workspace[] }
  'workspace:create': { args: [{ name: string; rootPath: string }]; result: Workspace }
  'workspace:open': { args: [string]; result: Workspace | null }
  'workspace:close': { args: [string]; result: void }
  'workspace:selectFolder': { args: []; result: string | null }
  'workspace:getState': { args: [string]; result: { sessions: Session[]; layout: WorkspaceLayout } | null }
  'workspace:saveState': { args: [Workspace, Session[], WorkspaceLayout, import('./task').Task[]?, string[]?]; result: void }
  'workspace:restore': { args: [string]; result: { sessions: Session[]; layout: WorkspaceLayout; workspace: Workspace; tasks?: import('./task').Task[]; pinnedFiles?: string[] } | null }

  'session:create': { args: [CreateSessionOptions]; result: Session }
  'session:write': { args: [string, string]; result: void }
  'session:resize': { args: [string, number, number]; result: void }
  'session:kill': { args: [string]; result: void }

  'fs:readDir': { args: [string]; result: DirEntry[] }
  'fs:listAllFiles': { args: [string]; result: string[] }
  'fs:watch:subscribe': { args: [string]; result: string }
  'fs:watch:unsubscribe': { args: [string]; result: void }

  'git:status': { args: [string]; result: GitStatus }
  'git:diff': { args: [string, string?]; result: string } // Second arg is optionally file path
  'git:log': { args: [string, number?]; result: GitLogEntry[] }
  'git:branches': { args: [string]; result: string[] }
  'git:checkout': { args: [string, string]; result: { success: boolean; error?: string } }
}

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface GitStatus {
  branch: string
  modified: string[]
  staged: string[]
  untracked: string[]
  ahead: number
  behind: number
}

export interface GitLogEntry {
  hash: string
  message: string
  author: string
  date: string
}

export type StreamChannel =
  | 'session:data'
  | 'session:exit'
  | 'fs:watch:event'

export interface StreamEvent<T = unknown> {
  channel: StreamChannel
  sessionId?: string
  watchId?: string
  data: T
}

export type IpcInvokeChannel = keyof IpcChannels
export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcChannels[C]['args']
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcChannels[C]['result']
