import { useState, useEffect, useCallback } from 'react'
import type { Session, SessionStatus } from '@shared/types/session'
import type { AgentType } from '@shared/types/session'
import type { Task } from '@shared/types/task'
import type { GitStatus, GitLogEntry } from '@shared/types/ipc'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  History,
  GitBranch,
  RefreshCw,
  Eye,
  X,
  FileCode,
  Calendar,
  User,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { useTimelineStore } from '../../stores/timelineStore'

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
  workspaceRootPath?: string
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
  onAssignSession,
  workspaceRootPath
}: AgentManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'timeline' | 'git'>('sessions')
  
  // Collapsible task states
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({})
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')

  // Git state
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [gitBranches, setGitBranches] = useState<string[]>([])
  const [gitLogs, setGitLogs] = useState<GitLogEntry[]>([])
  const [isGitLoading, setIsGitLoading] = useState(false)
  const [diffFile, setDiffFile] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<string>('')
  const [expandedCommits, setExpandedCommits] = useState<Record<string, boolean>>({})
  const [commitFiles, setCommitFiles] = useState<Record<string, { files: string[]; stats: string }>>({})

  // Timeline state
  const timelineEvents = useTimelineStore(
    (state) => (activeSessionId ? state.events[activeSessionId] : []) ?? []
  )
  const clearTimeline = useTimelineStore((state) => state.clearEvents)

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

  // Load Git Data
  const fetchGitInfo = useCallback(async () => {
    if (!workspaceRootPath) return
    setIsGitLoading(true)
    try {
      const status = await window.api.git.status(workspaceRootPath)
      setGitStatus(status)
      const branches = await window.api.git.branches(workspaceRootPath)
      setGitBranches(branches)
      const logs = await window.api.git.log(workspaceRootPath, 15)
      setGitLogs(logs)
    } catch (e) {
      console.error('Failed to load Git details', e)
    } finally {
      setIsGitLoading(false)
    }
  }, [workspaceRootPath])

  // Polling for Git status
  useEffect(() => {
    if (activeTab === 'git' && workspaceRootPath) {
      fetchGitInfo()
      const timer = setInterval(fetchGitInfo, 5000)
      return () => clearInterval(timer)
    }
    return undefined
  }, [activeTab, workspaceRootPath, fetchGitInfo])

  // Git checkout branch handler
  const handleBranchSwitch = async (newBranch: string) => {
    if (!workspaceRootPath || !gitStatus) return

    const isDirty = gitStatus.modified.length > 0 || gitStatus.staged.length > 0
    if (isDirty) {
      const confirmSwitch = window.confirm(
        'Warning: You have uncommitted changes. Switching branches might overwrite them. Are you sure you want to proceed?'
      )
      if (!confirmSwitch) return
    }

    try {
      const res = await window.api.git.checkout(workspaceRootPath, newBranch)
      if (res.success) {
        fetchGitInfo()
      } else {
        alert(`Checkout failed: ${res.error}`)
      }
    } catch (err: unknown) {
      alert(`Checkout error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // File diff handler
  const handleViewDiff = async (filePath: string) => {
    if (!workspaceRootPath) return
    try {
      const diff = await window.api.git.diff(workspaceRootPath, filePath)
      setDiffFile(filePath)
      setDiffContent(diff || 'No differences found.')
    } catch (err: unknown) {
      alert(`Error fetching diff: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleViewCommitFileDiff = async (commitHash: string, filePath: string) => {
    if (!workspaceRootPath) return
    try {
      const diff = await window.api.git.diff(workspaceRootPath, `${commitHash}^..${commitHash} -- ${filePath}`)
      setDiffFile(`${filePath} @ ${commitHash}`)
      setDiffContent(diff || 'No differences found for this file.')
    } catch (err: unknown) {
      // Fallback: try just viewing file diff without commit
      try {
        const diff = await window.api.git.diff(workspaceRootPath, filePath)
        setDiffFile(`${filePath} @ ${commitHash}`)
        setDiffContent(diff || 'No differences found.')
      } catch {
        alert(`Error fetching diff: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  const toggleCommit = async (hash: string) => {
    const isExpanded = expandedCommits[hash]
    setExpandedCommits((prev) => ({ ...prev, [hash]: !isExpanded }))

    // Fetch file list on first expand
    if (!isExpanded && !commitFiles[hash] && workspaceRootPath) {
      try {
        const result = await window.api.git.showFiles(workspaceRootPath, hash)
        setCommitFiles((prev) => ({ ...prev, [hash]: result }))
      } catch {
        setCommitFiles((prev) => ({ ...prev, [hash]: { files: [], stats: '' } }))
      }
    }
  }

  // Grouping sessions for the sessions list
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
    <div className="flex h-full flex-col bg-card border-l border-border relative">
      {/* Primary Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-3 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace Panel
        </span>
        {activeTab === 'sessions' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-secondary/10 px-1.5 py-1 shrink-0 gap-1 select-none">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex-1 py-1.5 text-center text-[11px] font-semibold rounded-md transition-all ${
            activeTab === 'sessions'
              ? 'bg-secondary text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-1.5 text-center text-[11px] font-semibold rounded-md transition-all ${
            activeTab === 'timeline'
              ? 'bg-secondary text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab('git')}
          disabled={!workspaceRootPath}
          className={`flex-1 py-1.5 text-center text-[11px] font-semibold rounded-md transition-all ${
            activeTab === 'git'
              ? 'bg-secondary text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-30'
          }`}
        >
          Git
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* --- SESSIONS TAB --- */}
        {activeTab === 'sessions' && (
          <div className="space-y-3">
            {isAddingTask && (
              <div className="mb-2 p-2 border border-border rounded-lg bg-secondary/15">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Task name..."
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
                    autoFocus
                  />
                  <button
                    className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={handleCreateTask}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {tasks.map((task) => {
              const taskSessions = sessions.filter((s) => task.sessionIds.includes(s.id))
              const isCollapsed = collapsedTasks[task.id] ?? false

              return (
                <div key={task.id} className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
                  <div
                    className="flex items-center justify-between p-2 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => toggleCollapse(task.id)}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate text-foreground">{task.name}</span>
                      <span className="text-[9px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground shrink-0">
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
                    <div className="p-1 bg-background/20 border-t border-border/30">
                      {taskSessions.length === 0 ? (
                        <div className="p-3 text-[10px] text-muted-foreground text-center">
                          No sessions. Move one here!
                        </div>
                      ) : (
                        taskSessions.map(renderSessionCard)
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned */}
            <div className="border border-border/50 rounded-lg overflow-hidden bg-secondary/5">
              <div
                className="flex items-center justify-between p-2 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
                onClick={() => toggleCollapse('unassigned')}
              >
                <div className="flex items-center gap-1.5">
                  {collapsedTasks['unassigned'] ? (
                    <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-muted-foreground">Unassigned Sessions</span>
                  <span className="text-[9px] rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                    {unassignedSessions.length}
                  </span>
                </div>
              </div>

              {!collapsedTasks['unassigned'] && (
                <div className="p-1 bg-background/20 border-t border-border/30">
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
        )}

        {/* --- TIMELINE TAB --- */}
        {activeTab === 'timeline' && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border shrink-0">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <History size={11} /> Activity Log
              </span>
              {activeSessionId && timelineEvents.length > 0 && (
                <button
                  className="text-[9px] text-destructive hover:underline font-medium"
                  onClick={() => clearTimeline(activeSessionId)}
                >
                  Clear Log
                </button>
              )}
            </div>

            <div className="flex-1 space-y-3 p-1.5 overflow-y-auto">
              {!activeSessionId ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Select a session to view its activity log.
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No activities detected yet. Execute terminal commands or type in prompt builder.
                </div>
              ) : (
                <div className="relative border-l border-border pl-3 space-y-4 ml-1">
                  {timelineEvents.map((evt) => {
                    const isSuccess = evt.status === 'success'
                    const isFailure = evt.status === 'failure'
                    const isGit = evt.type === 'git_commit'
                    const isTest = evt.type === 'test_runner'

                    return (
                      <div key={evt.id} className="relative group">
                        {/* Timeline Node Icon/Dot */}
                        <span className={`absolute -left-[17.5px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-card ${
                          isSuccess
                            ? 'bg-green-500'
                            : isFailure
                              ? 'bg-red-500'
                              : isGit
                                ? 'bg-cyan-500'
                                : isTest
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                        }`} />
                        
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground truncate pr-1">
                              {evt.title}
                            </span>
                            <span className="text-[9px] text-muted-foreground shrink-0 font-mono">
                              {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          {evt.description && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                              {evt.description}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- GIT AWARENESS TAB --- */}
        {activeTab === 'git' && workspaceRootPath && (
          <div className="space-y-4 p-1">
            {/* Header Branch Switcher */}
            <div className="border border-border/60 bg-secondary/5 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <GitBranch size={12} className="text-primary" /> Active Branch
                </span>
                <button
                  onClick={fetchGitInfo}
                  disabled={isGitLoading}
                  className="p-1 rounded text-muted-foreground hover:bg-secondary transition-colors"
                  title="Refresh Git status"
                >
                  <RefreshCw size={10} className={isGitLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {gitStatus ? (
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 bg-background border border-border/80 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary font-medium"
                    value={gitStatus.branch}
                    onChange={(e) => handleBranchSwitch(e.target.value)}
                  >
                    <option value={gitStatus.branch}>{gitStatus.branch}</option>
                    {gitBranches
                      .filter((b) => b !== gitStatus.branch)
                      .map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                  </select>
                  
                  {/* Ahead/Behind counts */}
                  {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <span className="text-[9px] font-mono text-muted-foreground bg-secondary/20 px-1.5 py-0.5 rounded shrink-0">
                      {gitStatus.ahead > 0 && `↑${gitStatus.ahead}`}
                      {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Not a git repository.</div>
              )}
            </div>

            {/* Changes List */}
            {gitStatus && (
              <div className="space-y-3.5">
                {/* Unstaged files */}
                {gitStatus.modified.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-amber-500 uppercase px-1">
                      <span>Unstaged Changes ({gitStatus.modified.length})</span>
                      <AlertTriangle size={10} />
                    </div>
                    <div className="space-y-1">
                      {gitStatus.modified.map((file) => (
                        <div
                          key={file}
                          className="group flex items-center justify-between text-xs rounded border border-border bg-secondary/5 px-2 py-1.5 hover:bg-secondary/15 hover:border-primary/20 cursor-pointer"
                          onClick={() => handleViewDiff(file)}
                        >
                          <span className="truncate pr-2 font-mono text-[11px] text-foreground">{file}</span>
                          <Eye size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staged files */}
                {gitStatus.staged.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-green-400 uppercase px-1">
                      <span>Staged Changes ({gitStatus.staged.length})</span>
                      <CheckCircle size={10} />
                    </div>
                    <div className="space-y-1">
                      {gitStatus.staged.map((file) => (
                        <div
                          key={file}
                          className="group flex items-center justify-between text-xs rounded border border-border bg-secondary/5 px-2 py-1.5 hover:bg-secondary/15 hover:border-primary/20 cursor-pointer"
                          onClick={() => handleViewDiff(file)}
                        >
                          <span className="truncate pr-2 font-mono text-[11px] text-foreground">{file}</span>
                          <Eye size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Untracked files */}
                {gitStatus.untracked.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase px-1">
                      <span>Untracked Files ({gitStatus.untracked.length})</span>
                      <FileCode size={10} />
                    </div>
                    <div className="space-y-1">
                      {gitStatus.untracked.map((file) => (
                        <div
                          key={file}
                          className="group flex items-center justify-between text-xs rounded border border-border bg-secondary/5 px-2 py-1.5 hover:bg-secondary/15 hover:border-primary/20 cursor-pointer"
                          onClick={() => handleViewDiff(file)}
                        >
                          <span className="truncate pr-2 font-mono text-[11px] text-muted-foreground">{file}</span>
                          <Eye size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No changes fallback */}
                {gitStatus.modified.length === 0 &&
                  gitStatus.staged.length === 0 &&
                  gitStatus.untracked.length === 0 && (
                    <div className="p-4 text-center border border-border/40 rounded-lg text-xs text-muted-foreground bg-secondary/5">
                      No modified or uncommitted files. Workspace clean.
                    </div>
                  )}
              </div>
            )}

            {/* Commit History */}
            {gitLogs.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Commit History
                </div>
                <div className="border border-border/50 rounded-lg overflow-hidden divide-y divide-border/45 bg-[#0d0d0d]">
                  {gitLogs.map((log) => {
                    const isExpanded = expandedCommits[log.hash] ?? false
                    const fileData = commitFiles[log.hash]
                    return (
                      <div key={log.hash}>
                        {/* Commit header row — click to expand */}
                        <div
                          className="flex items-start gap-2 p-2 cursor-pointer hover:bg-secondary/10 transition-colors select-none"
                          onClick={() => toggleCommit(log.hash)}
                        >
                          <span className="mt-0.5 shrink-0 text-muted-foreground">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-primary font-mono text-[10px] font-semibold">{log.hash}</span>
                              <span className="text-muted-foreground text-[9px] font-mono flex items-center gap-1">
                                <Calendar size={9} />{log.date}
                              </span>
                            </div>
                            <div className="text-xs text-foreground font-medium line-clamp-2 leading-snug">{log.message}</div>
                            <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                              <User size={8} />{log.author}
                              {fileData?.stats && (
                                <span className="ml-1 text-[9px] text-muted-foreground/70 font-mono">{fileData.stats}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded file list */}
                        {isExpanded && (
                          <div className="border-t border-border/30 bg-background/30">
                            {!fileData ? (
                              <div className="flex items-center justify-center py-3 text-[10px] text-muted-foreground">
                                <RefreshCw size={10} className="animate-spin mr-1.5" /> Loading files…
                              </div>
                            ) : fileData.files.length === 0 ? (
                              <div className="py-2 px-4 text-[10px] text-muted-foreground">No files found.</div>
                            ) : (
                              <div className="divide-y divide-border/20">
                                {fileData.files.map((file) => (
                                  <div
                                    key={file}
                                    className="group flex items-center justify-between px-4 py-1.5 hover:bg-secondary/10 cursor-pointer transition-colors"
                                    onClick={() => handleViewCommitFileDiff(log.hash, file)}
                                  >
                                    <span className="font-mono text-[10px] text-foreground truncate pr-2">{file}</span>
                                    <Eye size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- DIFF PREVIEW DIALOG MODAL --- */}
      {diffFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl h-[80vh] flex flex-col rounded-lg border border-border bg-[#0a0a0a] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-primary" />
                <span className="text-xs font-semibold font-mono text-foreground">{diffFile}</span>
              </div>
              <button
                onClick={() => setDiffFile(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Diff Viewer Area */}
            <div className="flex-1 overflow-auto p-4 bg-background font-mono text-xs leading-relaxed select-text">
              <pre className="whitespace-pre">
                {diffContent.split('\n').map((line, i) => {
                  const isAddition = line.startsWith('+') && !line.startsWith('+++')
                  const isDeletion = line.startsWith('-') && !line.startsWith('---')
                  const isHeader = line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('@@')

                  let lineClass = 'text-foreground/80'
                  if (isAddition) lineClass = 'text-green-400 bg-green-500/5'
                  if (isDeletion) lineClass = 'text-red-400 bg-red-500/5'
                  if (isHeader) lineClass = 'text-cyan-400 font-semibold'

                  return (
                    <div key={i} className={`px-1 rounded-sm ${lineClass}`}>
                      {line}
                    </div>
                  )
                })}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
