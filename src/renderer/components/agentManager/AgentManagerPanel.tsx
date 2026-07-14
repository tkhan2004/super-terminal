import type { Session, SessionStatus } from '@shared/types/session'
import type { AgentType } from '@shared/types/session'

interface AgentManagerPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  onCreateSession: () => void
}

const agentTypeColors: Record<AgentType, string> = {
  shell: 'bg-blue-500',
  claude: 'bg-orange-500',
  codex: 'bg-green-500',
  gemini: 'bg-purple-500',
  opencode: 'bg-cyan-500',
  amp: 'bg-yellow-500',
  unknown: 'bg-gray-500'
}

const statusColors: Record<SessionStatus, string> = {
  running: 'text-green-400',
  exited: 'text-red-400',
  resumable: 'text-yellow-400'
}

function formatRunningTime(createdAt: number): string {
  const elapsed = Date.now() - createdAt
  const minutes = Math.floor(elapsed / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return 'just now'
}

export function AgentManagerPanel({
  sessions,
  activeSessionId,
  onSelectSession,
  onCloseSession,
  onCreateSession
}: AgentManagerPanelProps) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Manager
        </span>
        <button
          className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-secondary"
          onClick={onCreateSession}
          title="New session"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No active sessions
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`mb-1 cursor-pointer rounded-lg border p-2 transition-colors ${
                activeSessionId === session.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${agentTypeColors[session.agentType]}`} />
                  <span className="text-xs font-medium">{session.title}</span>
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseSession(session.id)
                  }}
                >
                  ×
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className={statusColors[session.status]}>
                  {session.status === 'running' ? '● Running' : session.status === 'exited' ? '● Exited' : '● Resumable'}
                </span>
                <span>{formatRunningTime(session.createdAt)}</span>
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground" title={session.cwd}>
                {session.cwd}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
