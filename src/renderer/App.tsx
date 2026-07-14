import { useState, useCallback, useEffect, useRef } from 'react'
import type { Workspace, WorkspaceLayout } from '@shared/types/workspace'
import type { Session, AgentType } from '@shared/types/session'
import { TerminalPane } from './components/terminal/TerminalPane'
import { ThreeColumnLayout } from './components/layout/ThreeColumnLayout'
import { AgentManagerPanel } from './components/agentManager/AgentManagerPanel'
import { ExplorerTree } from './components/explorer/ExplorerTree'

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
  const [leftVisible, setLeftVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)
  const terminalAreaRef = useRef<HTMLDivElement>(null)
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>([])

  const loadWorkspacesList = useCallback(async () => {
    const list = await window.api.workspace.list()
    setWorkspacesList(list)
  }, [])

  const openWorkspace = useCallback(async (ws: Workspace) => {
    const state = await window.api.workspace.restore(ws.id)
    if (state) {
      setWorkspace(state.workspace)
      setTabs(state.sessions.map((s) => ({ session: s, title: s.title })))
      setActiveTabId(state.layout.activeSessionId)
    } else {
      setWorkspace(ws)
      setTabs([])
      setActiveTabId(null)
    }
  }, [])

  const selectFolder = useCallback(async () => {
    const folderPath = await window.api.workspace.selectFolder()
    if (!folderPath) return

    const folderName = folderPath.split(/[\\/]/).pop() || folderPath
    const list = await window.api.workspace.list()
    const existing = list.find((w: Workspace) => w.rootPath === folderPath)
    if (existing) {
      await openWorkspace(existing)
    } else {
      const ws = await window.api.workspace.create(folderName, folderPath)
      setWorkspace(ws)
      setTabs([])
      setActiveTabId(null)
    }
  }, [openWorkspace])

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

      const tab: TerminalTab = { session, title: session.title }
      setTabs((prev) => [...prev, tab])
      setActiveTabId(session.id)
      setShowNewTabDialog(false)
    },
    [workspace]
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

  const saveState = useCallback(async () => {
    if (!workspace || tabs.length === 0) return

    const layout: WorkspaceLayout = {
      workspaceId: workspace.id,
      windowBounds: { x: 100, y: 100, width: 1280, height: 800 },
      splitPaneTree: { type: 'leaf', sessionId: activeTabId ?? '' },
      activeSessionId: activeTabId
    }

    await window.api.workspace.saveState(
      workspace,
      tabs.map((t) => t.session),
      layout
    )
  }, [workspace, tabs, activeTabId])

  const closeWorkspace = useCallback(async () => {
    if (!workspace) return
    await saveState()
    for (const tab of tabs) {
      await window.api.session.kill(tab.session.id)
    }
    setWorkspace(null)
    setTabs([])
    setActiveTabId(null)
    loadWorkspacesList()
  }, [workspace, tabs, saveState, loadWorkspacesList])

  useEffect(() => {
    const handler = (): void => {
      saveState()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveState])

  useEffect(() => {
    if (!workspace) {
      loadWorkspacesList()
    }
  }, [workspace, loadWorkspacesList])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const text = e.dataTransfer.getData('text/plain')
      if (text && activeTabId) {
        window.api.session.write(activeTabId, text)
      }
    },
    [activeTabId]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  if (!workspace) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0a0a0a] text-foreground p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-center">AI Terminal Studio</h1>
          <p className="mb-8 text-xs text-center text-muted-foreground">
            Desktop control center for AI coding agents
          </p>
          
          <button
            className="mb-6 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={selectFolder}
          >
            Open Project Folder...
          </button>

          {workspacesList.length > 0 && (
            <div className="border-t border-border pt-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Workspaces
              </h2>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {workspacesList.map((ws) => (
                  <div
                    key={ws.id}
                    className="group flex items-center justify-between rounded border border-border bg-secondary/10 p-2.5 hover:border-primary/50 hover:bg-secondary/20 transition-all cursor-pointer"
                    onClick={() => openWorkspace(ws)}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-sm font-medium truncate">{ws.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{ws.rootPath}</span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await window.api.workspace.close(ws.id)
                        loadWorkspacesList()
                      }}
                      title="Delete workspace from history"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{workspace.name}</span>
          <span className="text-xs text-muted-foreground truncate max-w-md">{workspace.rootPath}</span>
          <button
            className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50 transition-colors"
            onClick={closeWorkspace}
          >
            Close
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
            onClick={() => setLeftVisible((v) => !v)}
          >
            Explorer
          </button>
          <button
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
            onClick={() => setRightVisible((v) => !v)}
          >
            Agents
          </button>
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
        <ThreeColumnLayout
          leftVisible={leftVisible}
          rightVisible={rightVisible}
          left={<ExplorerTree rootPath={workspace.rootPath} onFileDrag={() => {}} />}
          center={
            <div
              ref={terminalAreaRef}
              className="h-full w-full"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {activeTabId ? (
                <TerminalPane
                  sessionId={activeTabId}
                  isActive={true}
                  onActivate={() => {}}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No active terminal. Click + to create one.
                </div>
              )}
            </div>
          }
          right={
            <AgentManagerPanel
              sessions={tabs.map((t) => t.session)}
              activeSessionId={activeTabId}
              onSelectSession={(id) => setActiveTabId(id)}
              onCloseSession={(id) => closeTab(id)}
              onCreateSession={() => setShowNewTabDialog(true)}
            />
          }
        />
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const agentType: AgentType =
                    newCommand === 'claude' ? 'claude' :
                    newCommand === 'codex' ? 'codex' :
                    newCommand === 'gemini' ? 'gemini' : 'shell'
                  createTab(newCommand, agentType)
                }
              }}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  const agentType: AgentType =
                    newCommand === 'claude' ? 'claude' :
                    newCommand === 'codex' ? 'codex' :
                    newCommand === 'gemini' ? 'gemini' : 'shell'
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
