import type { WorkspaceRepository } from './workspaceRepositoryJson'
import type { Workspace, WorkspaceLayout } from '@shared/types/workspace'
import type { Session } from '@shared/types/session'
import type { Task } from '@shared/types/task'
import { ptyManager } from '../pty/ptyManager'
import { BrowserWindow } from 'electron'

export interface RestoreResult {
  workspace: Workspace
  sessions: Session[]
  layout: WorkspaceLayout
  tasks?: Task[]
  pinnedFiles?: string[]
  timeline?: Record<string, import('@shared/types/session').TimelineEvent[]>
}

export class RestoreService {
  constructor(private repo: WorkspaceRepository) {}

  listRestorableWorkspaces(): Workspace[] {
    return this.repo.listWorkspaces()
  }

  restoreWorkspace(
    workspaceId: string,
    win: BrowserWindow,
    autoResume: boolean = true
  ): RestoreResult | null {
    const state = this.repo.getWorkspaceState(workspaceId)
    if (!state) return null

    const restoredSessions: Session[] = []

    for (const savedSession of state.sessions) {
      if (autoResume && savedSession.status !== 'exited') {
        const session = ptyManager.createSession({
          id: savedSession.id,
          command: savedSession.command,
          cwd: savedSession.cwd,
          agentType: savedSession.agentType,
          title: savedSession.title,
          cols: 80,
          rows: 24
        })

        this.attachSessionListeners(session.id, win)

        restoredSessions.push({
          ...savedSession,
          id: session.id,
          status: 'running',
          lastActiveAt: Date.now()
        })
      } else {
        restoredSessions.push({
          ...savedSession,
          status: 'resumable'
        })
      }
    }

    const layout: WorkspaceLayout = {
      ...state.layout,
      activeSessionId: state.layout.activeSessionId ?? (restoredSessions.length > 0 ? restoredSessions[0].id : null)
    }

    return {
      workspace: state.workspace,
      sessions: restoredSessions,
      layout,
      tasks: state.tasks,
      pinnedFiles: state.pinnedFiles,
      timeline: state.timeline
    }
  }

  saveWorkspaceState(
    workspace: Workspace,
    sessions: Session[],
    layout: WorkspaceLayout,
    tasks?: Task[],
    pinnedFiles?: string[],
    timeline?: Record<string, import('@shared/types/session').TimelineEvent[]>
  ): void {
    this.repo.saveWorkspaceState({
      workspace,
      sessions,
      layout,
      tasks,
      pinnedFiles,
      timeline
    })
  }

  private attachSessionListeners(sessionId: string, win: BrowserWindow): void {
    const session = ptyManager.getSession(sessionId)
    if (!session) return

    session.on('data', (data: string) => {
      win.webContents.send('session:data', { sessionId, data })
    })
    session.on('exit', (exitCode: number) => {
      win.webContents.send('session:exit', { sessionId, exitCode })
    })
  }
}
