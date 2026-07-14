import { useState, useCallback } from 'react'
import type { Workspace } from '@shared/types/workspace'
import type { Session, AgentType } from '@shared/types/session'
import { TerminalPane } from './components/terminal/TerminalPane'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useSessionStore } from './stores/sessionStore'

interface TerminalTab {
  session: Session
  title: string
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [newCommand, setNewCommand] = useState('shell')
  const [showNewTabDialog, setShowNewTabDialog] = useState(false)

  const { setWorkspaces, setActiveWorkspace } = useWorkspaceStore()
  const { setSessions } = useSessionStore()

  const selectFolder = useCallback(async () => {
    const folderPath = await window.api.workspace.selectFolder()
    if (!folderPath) return

    const folderName = folderPath.split(/[\\/]/).pop() || folderPath
    const ws = await window.api.workspace.create(folderName, folderPath)
    setWorkspace(ws)
    setWorkspaces([ws])
    setActiveWorkspace(ws.id)
  }, [setWorkspaces, setActiveWorkspace])

  const createTab = useCallback(
    async (command: string, agentType: AgentType) => {
      if (!workspace) return

      const session = await window.api.session.create({
        workspaceId: workspace.id,
        command,
        cwd: workspace.rootPath,
        agentType,
        title: command === 'shell' ? 'Terminal' : command
      })

      const tab: TerminalTab = {
        session,
        title: session.title
      }
      setTabs((prev) => [...prev, tab])
      setActiveTabId(session.id)
      setSessions(workspace.id, [...tabs.map((t) => t.session), session])
      setShowNewTabDialog(false)
    },
    [workspace, tabs, setSessions]
  )

  const closeTab = useCallback(
    async (sessionId: string) => {
      await window.api.session.kill(sessionId)
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.session.id !== sessionId)
        if (activeTabId === sessionId) {
          setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].session.id : null)
        }
        return filtered
      })
    },
    [activeTabId]
  )

  if (!workspace) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-3xl font-bold">AI Terminal Studio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Desktop control center for AI coding agents
          </p>
          <button
            className="mt-8 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={selectFolder}
          >
            Open Project Folder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{workspace.name}</span>
          <span className="text-xs text-muted-foreground">{workspace.rootPath}</span>
        </div>
      </header>

      <div className="flex h-10 items-center gap-1 border-b border-border bg-card px-2">
        {tabs.map((tab) => (
          <div
            key={tab.session.id}
            className={`group flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs ${
              activeTabId === tab.session.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            onClick={() => setActiveTabId(tab.session.id)}
          >
            <span>{tab.title}</span>
            <button
              className="opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.session.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-secondary"
          onClick={() => setShowNewTabDialog(true)}
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTabId && (
          <TerminalPane
            sessionId={activeTabId}
            isActive={true}
            onActivate={() => {}}
          />
        )}
      </div>

      {showNewTabDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50"
          onClick={() => setShowNewTabDialog(false)}
        >
          <div
            className="w-80 rounded-lg border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold">New Terminal Session</h2>
            <input
              className="mb-3 w-full rounded border border-input bg-background px-3 py-2 text-sm"
              placeholder="Command (e.g. shell, claude, codex)"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  const agentType: AgentType =
                    newCommand === 'claude'
                      ? 'claude'
                      : newCommand === 'codex'
                        ? 'codex'
                        : newCommand === 'gemini'
                          ? 'gemini'
                          : 'shell'
                  createTab(newCommand, agentType)
                }}
              >
                Create
              </button>
              <button
                className="flex-1 rounded bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
                onClick={() => setShowNewTabDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
