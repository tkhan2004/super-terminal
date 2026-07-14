export type AgentType = 'shell' | 'claude' | 'codex' | 'gemini' | 'opencode' | 'amp' | 'unknown'

export type SessionStatus = 'running' | 'exited' | 'resumable'

export interface TimelineEvent {
  id: string
  sessionId: string
  type: 'prompt' | 'command' | 'git_commit' | 'test_runner' | 'shell_prompt' | 'generic'
  title: string
  timestamp: number
  description?: string
  status?: 'success' | 'failure' | 'pending' | 'info'
}

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
  cols?: number
  rows?: number
}
