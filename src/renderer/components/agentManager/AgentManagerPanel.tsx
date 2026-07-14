import { useState } from 'react'
import type { Session, SessionStatus } from '@shared/types/session'
import type { AgentType } from '@shared/types/session'
import type { Task } from '@shared/types/task'
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, FolderOpen } from 'lucide-react'

interface AgentManagerPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  onCreateSession: () => void
  tasks: Task[]
  onAddTask: (name: string) => void
  onRenameTask: (id: string, name: string) => void
  onRemoveTask: (id: string) => void
  onAssignSession: (sessionId: string, taskId: string) => void
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
  onCreateSession,
  tasks,
  onAddTask,
  onRenameTask,
  onRemoveTask,
  onAssignSession
}: AgentManagerPanelProps) {
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({})
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')

  const toggleCollapse = (taskId: string) => {
    setCollapsedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const handleCreateTask = () => {
    if (newTaskName.trim()) {
      onAddTask(newTaskName.trim())
      setNewTaskName('')
      setIsAddingTask(false)
    }
  }

  const handleRenameClick = (taskId: string, currentName: string) => {
    const newName = prompt('Enter new task name:', currentName)
    if (newName && newName.trim()) {
      onRenameTask(taskId, newName.trim())
    }
  }

  // Grouping sessions
  const assignedSessionIds = new Set(tasks.flatMap((t) => t.sessionIds))
  const unassignedSessions = sessions.filter((s) => !assignedSessionIds.has(s.id))

  const renderSessionCard = (session: Session) => (
    <div
      key={session.id}
      className={`mb-1.5 cursor-pointer rounded-lg border p-2 bg-secondary/10 hover:bg-secondary/20 transition-all ${
        activeSessionId === session.id
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
          : 'border-border hover:border-primary/30'
      }`}
      onClick={() => onSelectSession(session.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-2 w-2 rounded-full shrink-0 ${agentTypeColors[session.agentType]}`} />
          <span className="text-xs font-medium truncate">{session.title}</span>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Select dropdown to move/assign task */}
          <select
            className="bg-transparent border border-border/50 text-[10px] rounded px-1 text-muted-foreground hover:border-primary/50 focus:outline-none cursor-pointer"
            value={tasks.find((t) => t.sessionIds.includes(session.id))?.id ?? ''}
            onChange={(e) => onAssignSession(session.id, e.target.value)}
          >
            <option value="" className="bg-[#0f0f0f] text-foreground">Unassigned</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0f0f0f] text-foreground">
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="text-xs text-muted-foreground hover:text-destructive px-1"
            onClick={() => onCloseSession(session.id)}
            title="Kill session"
          >
            ×
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={statusColors[session.status]}>
          {session.status === 'running'
            ? '● Running'
            : session.status === 'exited'
              ? '● Exited'
              : '● Resumable'}
        </span>
        <span>{formatRunningTime(session.createdAt)}</span>
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground/80 font-mono" title={session.cwd}>
        {session.cwd}
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-card border-l border-border">
      <div className="flex h-10 items-center justify-between border-b border-border px-3 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Manager
        </span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={() => setIsAddingTask((v) => !v)}
            title="Create Task"
          >
            <FolderOpen size={14} />
          </button>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            onClick={onCreateSession}
            title="New Session"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {isAddingTask && (
        <div className="p-3 border-b border-border bg-secondary/10 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Task name (e.g. Fix OCR)"
              className="flex-1 rounded border border-border bg-background px-2.5 py-1 text-xs focus:border-primary focus:outline-none"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              autoFocus
            />
            <button
              className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/95 transition-colors"
              onClick={handleCreateTask}
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Render Collapsible Tasks */}
        {tasks.map((task) => {
          const taskSessions = sessions.filter((s) => task.sessionIds.includes(s.id))
          const isCollapsed = collapsedTasks[task.id] ?? false

          return (
            <div key={task.id} className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
              <div
                className="flex items-center justify-between p-2 bg-secondary/20 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => toggleCollapse(task.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-semibold truncate text-foreground">{task.name}</span>
                  <span className="text-[10px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground shrink-0">
                    {taskSessions.length}
                  </span>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded transition-colors"
                    onClick={() => handleRenameClick(task.id, task.name)}
                    title="Rename task"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-secondary/40 rounded transition-colors"
                    onClick={() => onRemoveTask(task.id)}
                    title="Delete task"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-1.5 bg-background/30 border-t border-border/30">
                  {taskSessions.length === 0 ? (
                    <div className="p-3 text-[10px] text-muted-foreground text-center">
                      No sessions in this task. Move one here!
                    </div>
                  ) : (
                    taskSessions.map(renderSessionCard)
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Unassigned sessions */}
        <div className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
          <div
            className="flex items-center justify-between p-2 bg-secondary/20 hover:bg-secondary/30 transition-colors cursor-pointer"
            onClick={() => toggleCollapse('unassigned')}
          >
            <div className="flex items-center gap-1.5">
              {collapsedTasks['unassigned'] ? (
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-semibold text-muted-foreground">Unassigned Sessions</span>
              <span className="text-[10px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                {unassignedSessions.length}
              </span>
            </div>
          </div>

          {!collapsedTasks['unassigned'] && (
            <div className="p-1.5 bg-background/30 border-t border-border/30">
              {unassignedSessions.length === 0 ? (
                <div className="p-3 text-[10px] text-muted-foreground text-center">
                  No unassigned sessions
                </div>
              ) : (
                unassignedSessions.map(renderSessionCard)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
