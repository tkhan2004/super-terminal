import { ipcMain, dialog, BrowserWindow } from 'electron'
import { ptyManager } from '../pty/ptyManager'
import type { Session, CreateSessionOptions } from '@shared/types/session'
import type { Workspace, WorkspaceLayout } from '@shared/types/workspace'
import { randomUUID } from 'node:crypto'
import { WorkspaceRepositoryJson } from '../workspace/workspaceRepositoryJson'
import { RestoreService } from '../workspace/restoreService'

let mainWindow: BrowserWindow | null = null
const repo = new WorkspaceRepositoryJson()
const restoreService = new RestoreService(repo)

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function registerIpcHandlers(): void {
  ipcMain.handle('workspace:list', handleWorkspaceList)
  ipcMain.handle('workspace:create', handleWorkspaceCreate)
  ipcMain.handle('workspace:open', handleWorkspaceOpen)
  ipcMain.handle('workspace:close', handleWorkspaceClose)
  ipcMain.handle('workspace:selectFolder', handleWorkspaceSelectFolder)
  ipcMain.handle('workspace:getState', handleWorkspaceGetState)
  ipcMain.handle('workspace:saveState', handleWorkspaceSaveState)
  ipcMain.handle('workspace:restore', handleWorkspaceRestore)

  ipcMain.handle('session:create', handleSessionCreate)
  ipcMain.handle('session:write', handleSessionWrite)
  ipcMain.handle('session:resize', handleSessionResize)
  ipcMain.handle('session:kill', handleSessionKill)
}

async function handleWorkspaceList(): Promise<Workspace[]> {
  return repo.listWorkspaces()
}

async function handleWorkspaceCreate(
  _event: unknown,
  opts: { name: string; rootPath: string }
): Promise<Workspace> {
  const workspace: Workspace = {
    id: randomUUID(),
    name: opts.name,
    rootPath: opts.rootPath,
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  }
  repo.saveWorkspace(workspace)
  return workspace
}

async function handleWorkspaceOpen(_event: unknown, id: string): Promise<Workspace | null> {
  return repo.getWorkspace(id)
}

async function handleWorkspaceClose(_event: unknown, id: string): Promise<void> {
  repo.deleteWorkspace(id)
}

async function handleWorkspaceSelectFolder(): Promise<string | null> {
  const win = getMainWindow()
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

async function handleWorkspaceGetState(
  _event: unknown,
  id: string
): Promise<{ sessions: Session[]; layout: WorkspaceLayout } | null> {
  const state = repo.getWorkspaceState(id)
  if (!state) return null
  return { sessions: state.sessions, layout: state.layout }
}

async function handleWorkspaceSaveState(
  _event: unknown,
  workspace: Workspace,
  sessions: Session[],
  layout: WorkspaceLayout
): Promise<void> {
  repo.saveWorkspaceState({ workspace, sessions, layout })
}

async function handleWorkspaceRestore(
  _event: unknown,
  workspaceId: string
): Promise<{ sessions: Session[]; layout: WorkspaceLayout; workspace: Workspace } | null> {
  const win = getMainWindow()
  if (!win) return null
  const result = restoreService.restoreWorkspace(workspaceId, win, true)
  if (!result) return null
  return result
}

async function handleSessionCreate(
  _event: unknown,
  opts: CreateSessionOptions
): Promise<Session> {
  const session = ptyManager.createSession({
    command: opts.command,
    cwd: opts.cwd,
    agentType: opts.agentType ?? 'shell',
    title: opts.title
  })

  const win = getMainWindow()
  if (win) {
    session.on('data', (data: string) => {
      win.webContents.send('session:data', { sessionId: session.id, data })
    })
    session.on('exit', (exitCode: number) => {
      win.webContents.send('session:exit', { sessionId: session.id, exitCode })
    })
  }

  const sessionMeta: Session = {
    id: session.id,
    workspaceId: opts.workspaceId,
    agentType: session.agentType,
    command: session.command,
    cwd: session.cwd,
    title: session.title,
    order: 0,
    status: 'running',
    createdAt: session.createdAt,
    lastActiveAt: Date.now()
  }

  return sessionMeta
}

async function handleSessionWrite(
  _event: unknown,
  sessionId: string,
  data: string
): Promise<void> {
  ptyManager.write(sessionId, data)
}

async function handleSessionResize(
  _event: unknown,
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  ptyManager.resize(sessionId, cols, rows)
}

async function handleSessionKill(_event: unknown, sessionId: string): Promise<void> {
  ptyManager.kill(sessionId)
}
