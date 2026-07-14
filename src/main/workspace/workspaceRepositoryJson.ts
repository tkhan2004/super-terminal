import { app } from 'electron'
import { join, dirname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import type { Workspace, WorkspaceLayout, WorkspaceState } from '@shared/types/workspace'
import type { Session } from '@shared/types/session'

export interface WorkspaceRepository {
  saveWorkspace(workspace: Workspace): void
  getWorkspace(id: string): Workspace | null
  listWorkspaces(): Workspace[]
  deleteWorkspace(id: string): void

  saveSessions(workspaceId: string, sessions: Session[]): void
  getSessions(workspaceId: string): Session[]

  saveLayout(layout: WorkspaceLayout): void
  getLayout(workspaceId: string): WorkspaceLayout | null

  getWorkspaceState(id: string): WorkspaceState | null
  saveWorkspaceState(state: WorkspaceState): void
}

export class WorkspaceRepositoryJson implements WorkspaceRepository {
  private dataDir: string

  constructor() {
    this.dataDir = join(app.getPath('userData'), 'workspaces')
    mkdirSync(this.dataDir, { recursive: true })
  }

  private workspacePath(id: string): string {
    return join(this.dataDir, `${id}.json`)
  }

  private scrollbackPath(sessionId: string): string {
    return join(this.dataDir, 'scrollback', `${sessionId}.txt`)
  }

  saveWorkspace(workspace: Workspace): void {
    const state = this.getWorkspaceState(workspace.id) ?? {
      workspace,
      sessions: [],
      layout: this.createDefaultLayout(workspace.id)
    }
    state.workspace = workspace
    this.writeJson(workspace.id, state)
  }

  getWorkspace(id: string): Workspace | null {
    const state = this.readJson(id)
    return state?.workspace ?? null
  }

  listWorkspaces(): Workspace[] {
    if (!existsSync(this.dataDir)) return []
    return readdirSync(this.dataDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .map((id) => this.getWorkspace(id))
      .filter((w): w is Workspace => w !== null)
  }

  deleteWorkspace(id: string): void {
    const path = this.workspacePath(id)
    if (existsSync(path)) {
      unlinkSync(path)
    }
  }

  saveSessions(workspaceId: string, sessions: Session[]): void {
    const state = this.getWorkspaceState(workspaceId)
    if (state) {
      state.sessions = sessions
      this.writeJson(workspaceId, state)
    }
  }

  getSessions(workspaceId: string): Session[] {
    const state = this.readJson(workspaceId)
    return state?.sessions ?? []
  }

  saveLayout(layout: WorkspaceLayout): void {
    const state = this.getWorkspaceState(layout.workspaceId)
    if (state) {
      state.layout = layout
      this.writeJson(layout.workspaceId, state)
    }
  }

  getLayout(workspaceId: string): WorkspaceLayout | null {
    const state = this.readJson(workspaceId)
    return state?.layout ?? null
  }

  getWorkspaceState(id: string): WorkspaceState | null {
    return this.readJson(id)
  }

  saveWorkspaceState(state: WorkspaceState): void {
    this.writeJson(state.workspace.id, state)
  }

  saveScrollback(sessionId: string, data: string): void {
    const dir = dirname(this.scrollbackPath(sessionId))
    mkdirSync(dir, { recursive: true })
    writeFileSync(this.scrollbackPath(sessionId), data, 'utf-8')
  }

  getScrollback(sessionId: string): string | null {
    const path = this.scrollbackPath(sessionId)
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf-8')
  }

  private createDefaultLayout(workspaceId: string): WorkspaceLayout {
    return {
      workspaceId,
      windowBounds: { x: 100, y: 100, width: 1280, height: 800 },
      splitPaneTree: { type: 'leaf', sessionId: '' },
      activeSessionId: null
    }
  }

  private readJson(id: string): WorkspaceState | null {
    const path = this.workspacePath(id)
    if (!existsSync(path)) return null
    try {
      const raw = readFileSync(path, 'utf-8')
      return JSON.parse(raw) as WorkspaceState
    } catch {
      return null
    }
  }

  private writeJson(id: string, state: WorkspaceState): void {
    const path = this.workspacePath(id)
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8')
  }
}
