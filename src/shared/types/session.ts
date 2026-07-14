export type AgentType = 'shell' | 'claude' | 'codex' | 'gemini' | 'opencode' | 'amp' | 'unknown'

export type SessionStatus = 'running' | 'exited' | 'resumable'

export interface Session {
  id: string
  workspaceId: string
  agentType: AgentType
  command: string
  cwd: string
  title: string
  order: number
  status: SessionStatus
  scrollbackRef?: string
  createdAt: number
  lastActiveAt: number
  exitCode?: number
}

export interface CreateSessionOptions {
  workspaceId: string
  command: string
  cwd: string
  agentType?: AgentType
  title?: string
}
