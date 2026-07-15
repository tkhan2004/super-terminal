import { ipcMain, dialog, BrowserWindow } from 'electron'
import { ptyManager } from '../pty/ptyManager'
import type { Session, CreateSessionOptions, TimelineEvent } from '@shared/types/session'
import type { Workspace, WorkspaceLayout } from '@shared/types/workspace'
import type { Task } from '@shared/types/task'
import { randomUUID } from 'node:crypto'
import { execFile, exec } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
  ipcMain.handle('git:commitDiff', handleGitCommitDiff)
  ipcMain.handle('git:push', handleGitPush)
  ipcMain.handle('claude:getCredentials', handleClaudeGetCredentials)
  ipcMain.handle('claude:getQuota', handleClaudeGetQuota)
  ipcMain.handle('quota:scanLogins', handleQuotaScanLogins)
  ipcMain.handle('commandcode:getQuota', handleCommandcodeGetQuota)
  ipcMain.handle('antigravity:getQuota', handleAntigravityGetQuota)
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
  pinnedFiles?: string[],
  timeline?: Record<string, TimelineEvent[]>
): Promise<void> {
  repo.saveWorkspaceState({ workspace, sessions, layout, tasks, pinnedFiles, timeline })
}

async function handleWorkspaceRestore(
  _event: unknown,
  workspaceId: string
): Promise<{ sessions: Session[]; layout: WorkspaceLayout; workspace: Workspace; tasks?: Task[]; pinnedFiles?: string[]; timeline?: Record<string, TimelineEvent[]> } | null> {
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
    title: opts.title,
    cols: opts.cols,
    rows: opts.rows
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
    const aheadCommits: GitLogEntry[] = []

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

    if (ahead > 0) {
      try {
        const logOutput = await runGit(cwd, [
          'log',
          '@{u}..HEAD',
          '--format=%h||%s||%an||%ad',
          '--date=short'
        ])
        const logLines = logOutput.trim().split('\n')
        for (const logLine of logLines) {
          if (!logLine.trim()) continue
          const parts = logLine.trim().split('||')
          if (parts.length === 4) {
            aheadCommits.push({
              hash: parts[0],
              message: parts[1],
              author: parts[2],
              date: parts[3]
            })
          }
        }
      } catch {
        // Ignored
      }
    }

    return {
      branch,
      modified,
      staged,
      untracked,
      ahead,
      behind,
      aheadCommits
    }
  } catch {
    return defaultStatus
  }
}

async function handleGitPush(
  _event: unknown,
  cwd: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await runGit(cwd, ['push'])
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
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

async function handleGitCommitDiff(
  _event: unknown,
  cwd: string,
  commitHash: string,
  filePath: string
): Promise<string> {
  try {
    // git show <hash> -- <file> gives the diff of that specific file in that commit
    return await runGit(cwd, ['show', commitHash, '--', filePath])
  } catch (err: unknown) {
    return `Error getting commit diff: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function handleClaudeGetCredentials(): Promise<{ isLoggedIn: boolean; accessToken?: string; subscriptionType?: string }> {
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json')
    if (existsSync(credPath)) {
      const data = JSON.parse(readFileSync(credPath, 'utf8'))
      if (data && data.claudeAiOauth) {
        return {
          isLoggedIn: true,
          accessToken: data.claudeAiOauth.accessToken,
          subscriptionType: data.claudeAiOauth.subscriptionType
        }
      }
    }
  } catch (err) {
    console.error('[Main] Error reading Claude credentials:', err)
  }
  return { isLoggedIn: false }
}

async function handleClaudeGetQuota(): Promise<{
  success: boolean
  sessionUsed?: number
  sessionReset?: string
  weekUsed?: number
  weekReset?: string
  fableUsed?: number
  error?: string
}> {
  return new Promise((resolve) => {
    const localClaudePath = join(homedir(), '.local', 'bin', 'claude.exe')
    const command = existsSync(localClaudePath) ? `"${localClaudePath}" -p` : 'claude -p'

    const child = exec(command, (error, stdout, _stderr) => {
      if (error) {
        resolve({ success: false, error: error.message })
        return
      }

      try {
        const sessionRegex = /Current session:\s*(\d+)%\s*used\s*·\s*resets\s*([^\n\r]+)/
        const weekRegex = /Current week \(all models\):\s*(\d+)%\s*used\s*·\s*resets\s*([^\n\r]+)/
        const fableRegex = /Current week \(Fable\):\s*(\d+)%\s*used/

        const sessionMatch = stdout.match(sessionRegex)
        const weekMatch = stdout.match(weekRegex)
        const fableMatch = stdout.match(fableRegex)

        resolve({
          success: true,
          sessionUsed: sessionMatch ? parseInt(sessionMatch[1], 10) : undefined,
          sessionReset: sessionMatch ? sessionMatch[2].trim() : undefined,
          weekUsed: weekMatch ? parseInt(weekMatch[1], 10) : undefined,
          weekReset: weekMatch ? weekMatch[2].trim() : undefined,
          fableUsed: fableMatch ? parseInt(fableMatch[1], 10) : undefined
        })
      } catch (err) {
        resolve({ success: false, error: String(err) })
      }
    })

    child.stdin?.write('/usage\n')
    child.stdin?.end()
  })
}

function isNonEmptyCredentialFile(path: string): boolean {
  try {
    if (!existsSync(path)) return false
    const raw = readFileSync(path, 'utf8').trim()
    if (!raw) return false
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
}

// Antigravity stores its OAuth token in the OS keyring (Windows Credential
// Manager), not a plain file, so we can't detect login the same way as the
// others. `cmdkey /list` reads the real credential store without exposing
// secrets — best signal available without a native keyring dependency.
function checkWindowsCredentialManager(needle: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec('cmdkey /list', (error, stdout) => {
      if (error) {
        resolve(false)
        return
      }
      resolve(stdout.toLowerCase().includes(needle.toLowerCase()))
    })
  })
}

async function handleQuotaScanLogins(): Promise<{
  claude: boolean
  codex: boolean
  antigravity: boolean
  commandcodeai: boolean
  opencode: boolean
}> {
  const claude = (await handleClaudeGetCredentials()).isLoggedIn

  const codex = isNonEmptyCredentialFile(
    join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json')
  )

  const opencode =
    isNonEmptyCredentialFile(join(homedir(), '.local', 'share', 'opencode', 'auth.json')) ||
    (process.env.LOCALAPPDATA
      ? isNonEmptyCredentialFile(join(process.env.LOCALAPPDATA, 'opencode', 'auth.json'))
      : false) ||
    (process.env.APPDATA
      ? existsSync(join(process.env.APPDATA, 'ai.opencode.desktop', 'opencode.global.dat'))
      : false)

  const commandcodeai =
    !!process.env.COMMAND_CODE_API_KEY ||
    isNonEmptyCredentialFile(join(homedir(), '.commandcode', 'auth.json'))

  const antigravity =
    (await checkWindowsCredentialManager('antigravity')) ||
    existsSync(join(homedir(), '.antigravity_cockpit', 'credentials.json')) ||
    !!process.env.ANTIGRAVITY_AGENT

  return { claude, codex, antigravity, commandcodeai, opencode }
}

async function handleCommandcodeGetQuota(): Promise<{
  success: boolean
  fiveHourUsed?: number
  fiveHourCap?: number
  fiveHourReset?: string
  weeklyUsed?: number
  weeklyCap?: number
  weeklyReset?: string
  error?: string
}> {
  try {
    let apiKey = process.env.COMMAND_CODE_API_KEY
    if (!apiKey) {
      const authPath = join(homedir(), '.commandcode', 'auth.json')
      if (existsSync(authPath)) {
        const auth = JSON.parse(readFileSync(authPath, 'utf8'))
        apiKey = auth.apiKey
      }
    }

    if (!apiKey) {
      return { success: false, error: 'No API Key found' }
    }

    const res = await fetch('https://api.commandcode.ai/alpha/billing/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (!res.ok) {
      return { success: false, error: `API responded with status ${res.status}` }
    }

    const data = await res.json() as any
    const fiveHour = data.windowLimits?.fiveHour
    const weekly = data.windowLimits?.weekly

    const formatReset = (ts: number | undefined) => {
      if (!ts) return undefined
      const date = new Date(ts)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return {
      success: true,
      fiveHourUsed: fiveHour ? Math.round((fiveHour.used / fiveHour.cap) * 100) : undefined,
      fiveHourCap: fiveHour?.cap,
      fiveHourReset: formatReset(fiveHour?.resetAt),
      weeklyUsed: weekly ? Math.round((weekly.used / weekly.cap) * 100) : undefined,
      weeklyCap: weekly?.cap,
      weeklyReset: formatReset(weekly?.resetAt)
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function handleAntigravityGetQuota(): Promise<{
  success: boolean
  fiveHourUsed?: number
  fiveHourReset?: string
  weeklyUsed?: number
  weeklyReset?: string
  error?: string
}> {
  return new Promise((resolve) => {
    let resolved = false
    let output = ''

    const agyPath = process.platform === 'win32' ? 'agy.exe' : 'agy'
    let ptyProcess: any

    try {
      const pty = require('node-pty')
      ptyProcess = pty.spawn(agyPath, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: homedir(),
        env: process.env
      })

      ptyProcess.onData((data: string) => {
        output += data
      })

      const timer1 = setTimeout(() => {
        if (!resolved) {
          ptyProcess.write('/usage\r\n')
        }
      }, 2500)

      const timer2 = setTimeout(() => {
        if (!resolved) {
          resolved = true
          cleanupAndResolve()
        }
      }, 5000)

      const cleanupAndResolve = () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        try {
          ptyProcess.kill()
        } catch {}

        try {
          const cleanOutput = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

          const fiveHourMatch = cleanOutput.match(/Five Hour Limit\s*(?:\r?\n\s*)?\[[█░]+\]\s*([\d.]+)%\s*(?:\r?\n\s*)?(\d+)%\s*remaining\s*·\s*Refreshes\s*in\s*([^\n\r]+)/i)
          const weeklyMatch = cleanOutput.match(/Weekly Limit\s*(?:\r?\n\s*)?\[[█░]+\]\s*([\d.]+)%\s*(?:\r?\n\s*)?(\d+)%\s*remaining\s*·\s*Refreshes\s*in\s*([^\n\r]+)/i)

          const fiveHourRemaining = fiveHourMatch ? parseInt(fiveHourMatch[2], 10) : undefined
          const weeklyRemaining = weeklyMatch ? parseInt(weeklyMatch[2], 10) : undefined

          resolve({
            success: true,
            fiveHourUsed: fiveHourRemaining !== undefined ? (100 - fiveHourRemaining) : undefined,
            fiveHourReset: fiveHourMatch ? fiveHourMatch[3].trim() : undefined,
            weeklyUsed: weeklyRemaining !== undefined ? (100 - weeklyRemaining) : undefined,
            weeklyReset: weeklyMatch ? weeklyMatch[3].trim() : undefined
          })
        } catch (err) {
          resolve({ success: false, error: String(err) })
        }
      }
    } catch (err) {
      if (!resolved) {
        resolved = true
        resolve({ success: false, error: String(err) })
      }
    }
  })
}
