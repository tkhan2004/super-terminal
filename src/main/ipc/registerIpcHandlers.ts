import { ipcMain, dialog, BrowserWindow } from 'electron'
import { ptyManager } from '../pty/ptyManager'
import type { Session, CreateSessionOptions } from '@shared/types/session'
import type { Workspace, WorkspaceLayout } from '@shared/types/workspace'
import type { Task } from '@shared/types/task'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { WorkspaceRepositoryJson } from '../workspace/workspaceRepositoryJson'
import { RestoreService } from '../workspace/restoreService'
import type { GitStatus, GitLogEntry } from '@shared/types/ipc'

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

  ipcMain.handle('git:status', handleGitStatus)
  ipcMain.handle('git:diff', handleGitDiff)
  ipcMain.handle('git:log', handleGitLog)
  ipcMain.handle('git:branches', handleGitBranches)
  ipcMain.handle('git:checkout', handleGitCheckout)
  ipcMain.handle('git:showFiles', handleGitShowFiles)
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
  try {
    const win = getMainWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  } catch (err) {
    console.error('[Main] Error in selectFolder dialog:', err)
    return null
  }
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
  layout: WorkspaceLayout,
  tasks?: Task[],
  pinnedFiles?: string[]
): Promise<void> {
  repo.saveWorkspaceState({ workspace, sessions, layout, tasks, pinnedFiles })
}

async function handleWorkspaceRestore(
  _event: unknown,
  workspaceId: string
): Promise<{ sessions: Session[]; layout: WorkspaceLayout; workspace: Workspace; tasks?: Task[]; pinnedFiles?: string[] } | null> {
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

/* Git Helper and IPC Handlers */

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

async function handleGitStatus(_event: unknown, cwd: string): Promise<GitStatus> {
  const defaultStatus: GitStatus = {
    branch: '',
    modified: [],
    staged: [],
    untracked: [],
    ahead: 0,
    behind: 0
  }
  try {
    await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
    
    let branch = ''
    try {
      branch = (await runGit(cwd, ['branch', '--show-current'])).trim()
      if (!branch) {
        branch = (await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
      }
    } catch {
      branch = 'HEAD'
    }

    const statusOutput = await runGit(cwd, ['status', '--porcelain'])
    const lines = statusOutput.split('\n')
    const modified: string[] = []
    const staged: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      if (line.length < 4) continue
      const indexStatus = line[0]
      const worktreeStatus = line[1]
      const filePath = line.substring(3).trim()

      if (indexStatus === '?' && worktreeStatus === '?') {
        untracked.push(filePath)
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(filePath)
        }
        if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
          modified.push(filePath)
        }
      }
    }

    let ahead = 0
    let behind = 0
    try {
      const abOutput = await runGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'])
      const parts = abOutput.trim().split(/\s+/)
      if (parts.length === 2) {
        ahead = parseInt(parts[0], 10) || 0
        behind = parseInt(parts[1], 10) || 0
      }
    } catch {
      // Ignored
    }

    return {
      branch,
      modified,
      staged,
      untracked,
      ahead,
      behind
    }
  } catch {
    return defaultStatus
  }
}

async function handleGitDiff(_event: unknown, cwd: string, filePath?: string): Promise<string> {
  try {
    const args = ['diff', 'HEAD']
    if (filePath) {
      args.push('--', filePath)
    }
    return await runGit(cwd, args)
  } catch (err: unknown) {
    return `Error getting diff: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function handleGitLog(
  _event: unknown,
  cwd: string,
  limit: number = 20
): Promise<GitLogEntry[]> {
  try {
    const stdout = await runGit(cwd, [
      'log',
      `-n`,
      String(limit),
      `--pretty=format:%h%n%s%n%an%n%ad%n---`
    ])
    const entries: GitLogEntry[] = []
    const blocks = stdout.split('\n---\n')
    for (const block of blocks) {
      const lines = block.split('\n')
      if (lines.length >= 4) {
        entries.push({
          hash: lines[0].trim(),
          message: lines[1].trim(),
          author: lines[2].trim(),
          date: lines[3].trim()
        })
      }
    }
    return entries
  } catch {
    return []
  }
}

async function handleGitBranches(_event: unknown, cwd: string): Promise<string[]> {
  try {
    const stdout = await runGit(cwd, ['branch', '-a', '--format=%(refname:short)'])
    const branches = stdout
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0 && !b.includes('origin/HEAD'))
    return Array.from(new Set(branches))
  } catch {
    return []
  }
}

async function handleGitCheckout(
  _event: unknown,
  cwd: string,
  branchName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await runGit(cwd, ['checkout', branchName])
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function handleGitShowFiles(
  _event: unknown,
  cwd: string,
  commitHash: string
): Promise<{ files: string[]; stats: string }> {
  try {
    // Get list of files changed in this commit
    const nameOnly = await runGit(cwd, [
      'show',
      '--name-only',
      '--format=',
      commitHash
    ])
    const files = nameOnly
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0)

    // Get short stat summary line
    const statOut = await runGit(cwd, [
      'show',
      '--stat',
      '--format=',
      commitHash
    ])
    const statLines = statOut.split('\n').filter((l) => l.trim().length > 0)
    const stats = statLines[statLines.length - 1] ?? ''

    return { files, stats }
  } catch {
    return { files: [], stats: '' }
  }
}
