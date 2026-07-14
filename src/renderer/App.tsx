import { useState, useCallback, useEffect, useRef } from 'react'
import type { Workspace, WorkspaceLayout, SplitPaneNode } from '@shared/types/workspace'
import type { Session, AgentType } from '@shared/types/session'
import { ThreeColumnLayout } from './components/layout/ThreeColumnLayout'
import { AgentManagerPanel } from './components/agentManager/AgentManagerPanel'
import { ExplorerTree } from './components/explorer/ExplorerTree'
import { TerminalSplitView } from './components/terminal/TerminalSplitView'
import { ContextPanel } from './components/explorer/ContextPanel'
import { PromptBuilderBar } from './components/promptBuilder/PromptBuilderBar'
import { CommandPalette } from './components/commandPalette/CommandPalette'
import { useTaskStore } from './stores/taskStore'
import { useTimelineStore } from './stores/timelineStore'
import { X, Plus } from 'lucide-react'

function splitLeaf(
  node: SplitPaneNode,
  targetSessionId: string,
  newSessionId: string,
  direction: 'horizontal' | 'vertical'
): SplitPaneNode {
  if (node.type === 'leaf') {
    if (node.sessionId === targetSessionId) {
      return {
        type: 'split',
        direction,
        sizes: [50, 50],
        children: [
          { type: 'leaf', sessionId: targetSessionId },
          { type: 'leaf', sessionId: newSessionId }
        ]
      }
    }
    return node
  }

  return {
    ...node,
    children: node.children.map((child) =>
      splitLeaf(child, targetSessionId, newSessionId, direction)
    )
  }
}

function removeLeaf(node: SplitPaneNode, targetSessionId: string): SplitPaneNode | null {
  if (node.type === 'leaf') {
    if (node.sessionId === targetSessionId) {
      return null
    }
    return node
  }

  const newChildren = node.children
    .map((child) => removeLeaf(child, targetSessionId))
    .filter((child): child is SplitPaneNode => child !== null)

  if (newChildren.length === 0) {
    return null
  }
  if (newChildren.length === 1) {
    return newChildren[0]
  }

  const newSizes = newChildren.map((_, i) => node.sizes[i] ?? 100 / newChildren.length)
  const sum = newSizes.reduce((a, b) => a + b, 0)
  const normalizedSizes = newSizes.map((s) => (s / sum) * 100)

  return {
    ...node,
    sizes: normalizedSizes,
    children: newChildren
  }
}

interface TerminalTab {
  session: Session
  title: string
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [openWorkspaces, setOpenWorkspaces] = useState<Workspace[]>([])
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [newCommand, setNewCommand] = useState('shell')
  const [showNewTabDialog, setShowNewTabDialog] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [leftVisible, setLeftVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)
  const terminalAreaRef = useRef<HTMLDivElement>(null)
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>([])
  const [layoutTree, setLayoutTree] = useState<SplitPaneNode | null>(null)

  const {
    tasks,
    setTasks,
    addTask,
    removeTask,
    updateTaskName,
    assignSessionToTask,
    unassignSessionFromTask
  } = useTaskStore()
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])
  const [sessionReferences, setSessionReferences] = useState<Record<string, string[]>>({})
  const [tabLayouts, setTabLayouts] = useState<Record<string, SplitPaneNode>>({})
  const spawningRef = useRef(false)

  const handlePinFile = useCallback((path: string) => {
    setPinnedFiles((prev) => {
      if (prev.includes(path)) return prev
      return [...prev, path]
    })
  }, [])

  const handleUnpinFile = useCallback((path: string) => {
    setPinnedFiles((prev) => prev.filter((p) => p !== path))
  }, [])

  const handleInsertReference = useCallback((path: string) => {
    if (activeTabId) {
      window.api.session.write(activeTabId, `@${path}`)
      setSessionReferences((prev) => {
        const current = prev[activeTabId] ?? []
        if (!current.includes(path)) {
          return { ...prev, [activeTabId]: [...current, path] }
        }
        return prev
      })
    }
  }, [activeTabId])

  const handleAddTask = useCallback((name: string) => {
    addTask({
      id: crypto.randomUUID(),
      workspaceId: workspace!.id,
      name,
      sessionIds: [],
      createdAt: Date.now()
    })
  }, [workspace, addTask])

  const handleRenameTask = useCallback((id: string, name: string) => {
    updateTaskName(id, name)
  }, [updateTaskName])

  const handleRemoveTask = useCallback((id: string) => {
    removeTask(id)
  }, [removeTask])

  const handleAssignSession = useCallback((sessionId: string, taskId: string) => {
    if (taskId === '') {
      unassignSessionFromTask(sessionId)
    } else {
      assignSessionToTask(taskId, sessionId)
    }
  }, [assignSessionToTask, unassignSessionFromTask])

  const handleSendPrompt = useCallback((text: string, attachedFiles: string[]) => {
    if (!activeTabId) return
    const composed = text + (attachedFiles.length > 0 ? ' ' + attachedFiles.map(f => `@${f}`).join(' ') : '')
    window.api.session.write(activeTabId, composed + '\n')

    if (attachedFiles.length > 0) {
      setSessionReferences((prev) => {
        const current = prev[activeTabId] ?? []
        const updated = [...current]
        for (const file of attachedFiles) {
          if (!updated.includes(file)) {
            updated.push(file)
          }
        }
        return { ...prev, [activeTabId]: updated }
      })
    }

    useTimelineStore.getState().addEvent(activeTabId, {
      type: 'prompt',
      title: 'Prompt Sent',
      description: text + (attachedFiles.length > 0 ? ` (attached: ${attachedFiles.join(', ')})` : ''),
      status: 'info'
    })
  }, [activeTabId])

  const loadWorkspacesList = useCallback(async () => {
    const list = await window.api.workspace.list()
    setWorkspacesList(list)
  }, [])



  const createTab = useCallback(
    async (command: string, agentType: AgentType) => {
      if (!workspace) return

      let cols = 80
      let rows = 24
      if (terminalAreaRef.current) {
        const width = terminalAreaRef.current.clientWidth
        const height = terminalAreaRef.current.clientHeight
        cols = Math.max(80, Math.floor(width / 8.5))
        rows = Math.max(24, Math.floor(height / 18))
      }

      const session = await window.api.session.create({
        workspaceId: workspace.id,
        command,
        cwd: workspace.rootPath,
        agentType,
        title: command === 'shell' ? 'Terminal' : command,
        cols,
        rows
      })

      const tab: TerminalTab = { session, title: session.title }
      setTabs((prev) => [...prev, tab])
      setTabLayouts((prev) => ({
        ...prev,
        [session.id]: { type: 'leaf', sessionId: session.id }
      }))
      setActiveTabId(session.id)
      setShowNewTabDialog(false)
      setNewCommand('shell')
    },
    [workspace, setNewCommand, setTabLayouts]
  )

  const closeTab = useCallback(
    async (sessionId: string) => {
      await window.api.session.kill(sessionId)
      
      let nextActiveId: string | null = null
      setTabs((prev) => {
        const filtered = prev.filter((t) => t.session.id !== sessionId)
        if (activeTabId === sessionId) {
          nextActiveId = filtered.length > 0 ? filtered[filtered.length - 1].session.id : null
        } else {
          nextActiveId = activeTabId
        }
        return filtered
      })
      
      if (activeTabId === sessionId) {
        setActiveTabId(nextActiveId)
      }

      setTabLayouts((prev) => {
        const copy = { ...prev }
        for (const [key, tree] of Object.entries(copy)) {
          const updated = removeLeaf(tree, sessionId)
          if (updated) {
            copy[key] = updated
          } else {
            delete copy[key]
          }
        }
        delete copy[sessionId]
        return copy
      })
    },
    [activeTabId, setTabLayouts]
  )

  const saveState = useCallback(async () => {
    if (!workspace || tabs.length === 0) return

    const layout: WorkspaceLayout = {
      workspaceId: workspace.id,
      windowBounds: { x: 100, y: 100, width: 1280, height: 800 },
      splitPaneTree: layoutTree ?? { type: 'leaf', sessionId: activeTabId ?? '' },
      activeSessionId: activeTabId,
      tabLayouts
    }

    const timeline = useTimelineStore.getState().events
    await window.api.workspace.saveState(
      workspace,
      tabs.map((t) => t.session),
      layout,
      tasks,
      pinnedFiles,
      timeline
    )
  }, [workspace, tabs, activeTabId, layoutTree, tasks, pinnedFiles, tabLayouts])

  const openWorkspace = useCallback(async (ws: Workspace) => {
    try {
      if (workspace) {
        await saveState()
      }

      const state = await window.api.workspace.restore(ws.id)
      if (state) {
        setWorkspace(state.workspace)
        setTabs(state.sessions.map((s) => ({ session: s, title: s.title })))
        setActiveTabId(state.layout.activeSessionId)
        setLayoutTree(state.layout.splitPaneTree)
        setTasks(state.tasks ?? [])
        setPinnedFiles(state.pinnedFiles ?? [])
        setTabLayouts(state.layout.tabLayouts ?? {})
        useTimelineStore.getState().setWorkspaceEvents(state.timeline ?? {})
      } else {
        setWorkspace(ws)
        setTabs([])
        setActiveTabId(null)
        setLayoutTree(null)
        setTasks([])
        setPinnedFiles([])
        setTabLayouts({})
        useTimelineStore.getState().setWorkspaceEvents({})
      }

      setOpenWorkspaces((prev) => {
        if (prev.some((w) => w.id === ws.id)) return prev
        return [...prev, ws]
      })
    } catch (err) {
      console.error('[Renderer] Error in openWorkspace:', err)
    }
  }, [workspace, saveState, setTasks, setTabLayouts, setOpenWorkspaces])

  const selectFolder = useCallback(async () => {
    try {
      const folderPath = await window.api.workspace.selectFolder()
      if (!folderPath) {
        console.log('[Renderer] selectFolder: No path returned')
        return
      }

      const folderName = folderPath.split(/[\\/]/).pop() || folderPath
      const list = await window.api.workspace.list()
      const existing = list.find((w: Workspace) => w.rootPath === folderPath)
      if (existing) {
        await openWorkspace(existing)
      } else {
        const ws = await window.api.workspace.create(folderName, folderPath)
        if (workspace) {
          await saveState()
        }
        setWorkspace(ws)
        setTabs([])
        setActiveTabId(null)
        setLayoutTree(null)
        setTasks([])
        setPinnedFiles([])
        setTabLayouts({})
        setOpenWorkspaces((prev) => {
          if (prev.some((w) => w.id === ws.id)) return prev
          return [...prev, ws]
        })
      }
    } catch (err) {
      console.error('[Renderer] Error in selectFolder:', err)
    }
  }, [workspace, openWorkspace, saveState, setTasks])

  const closeProjectTab = useCallback(async (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const wsToClose = openWorkspaces.find((w) => w.id === wsId)
    if (!wsToClose) return

    if (workspace && workspace.id === wsId) {
      await saveState()
      for (const tab of tabs) {
        await window.api.session.kill(tab.session.id)
      }

      const remaining = openWorkspaces.filter((w) => w.id !== wsId)
      if (remaining.length > 0) {
        const nextWs = remaining[remaining.length - 1]
        setWorkspace(null)
        setTabs([])
        setActiveTabId(null)
        setLayoutTree(null)
        setTasks([])
        setPinnedFiles([])
        setTabLayouts({})
        await openWorkspace(nextWs)
      } else {
        setWorkspace(null)
        setTabs([])
        setActiveTabId(null)
        setLayoutTree(null)
        setTasks([])
        setPinnedFiles([])
        setTabLayouts({})
      }
    } else {
      try {
        const state = await window.api.workspace.restore(wsId)
        if (state) {
          for (const s of state.sessions) {
            await window.api.session.kill(s.id)
          }
        }
      } catch (err) {
        console.error('Failed to clean up sessions for closed project:', err)
      }
    }
    setOpenWorkspaces((prev) => prev.filter((w) => w.id !== wsId))
  }, [workspace, openWorkspaces, tabs, saveState, openWorkspace, setTasks])



  const handleSplit = useCallback(
    async (direction: 'horizontal' | 'vertical') => {
      if (!workspace || !activeTabId) return

      const newSession = await window.api.session.create({
        workspaceId: workspace.id,
        command: 'shell',
        cwd: workspace.rootPath,
        agentType: 'shell',
        title: 'Terminal'
      })

      const tab: TerminalTab = { session: newSession, title: newSession.title }
      setTabs((prev) => [...prev, tab])
      
      setTabLayouts((prev) => {
        const copy = { ...prev }
        // Find which tab root contains activeTabId
        let foundTabKey = activeTabId
        for (const [key, tree] of Object.entries(copy)) {
          if (JSON.stringify(tree).includes(activeTabId)) {
            foundTabKey = key
            break
          }
        }
        const currentTree = copy[foundTabKey] ?? { type: 'leaf', sessionId: activeTabId }
        copy[foundTabKey] = splitLeaf(currentTree, activeTabId, newSession.id, direction)
        return copy
      })

      setActiveTabId(newSession.id)
    },
    [workspace, activeTabId, setTabLayouts]
  )

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (!workspace) return

      // Ctrl+K or Ctrl+P: Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p')) {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
        return
      }

      // Ctrl+B: Toggle Left Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !e.shiftKey) {
        e.preventDefault()
        setLeftVisible((v) => !v)
        return
      }

      // Ctrl+Shift+B: Toggle Right Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && e.shiftKey) {
        e.preventDefault()
        setRightVisible((v) => !v)
        return
      }

      // Ctrl+\: Split Vertically
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        handleSplit('vertical')
        return
      }

      // Ctrl+-: Split Horizontally
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        handleSplit('horizontal')
        return
      }

      // Ctrl+Shift+W: Close Active Tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
        return
      }

      // Ctrl+PageDown / Ctrl+Alt+Right: Next Session
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') ||
        (e.ctrlKey && e.altKey && e.key === 'ArrowRight')
      ) {
        e.preventDefault()
        setTabs((prevTabs) => {
          if (prevTabs.length <= 1) return prevTabs
          const idx = prevTabs.findIndex((t) => t.session.id === activeTabId)
          const nextIdx = (idx + 1) % prevTabs.length
          setActiveTabId(prevTabs[nextIdx].session.id)
          return prevTabs
        })
        return
      }

      // Ctrl+PageUp / Ctrl+Alt+Left: Prev Session
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') ||
        (e.ctrlKey && e.altKey && e.key === 'ArrowLeft')
      ) {
        e.preventDefault()
        setTabs((prevTabs) => {
          if (prevTabs.length <= 1) return prevTabs
          const idx = prevTabs.findIndex((t) => t.session.id === activeTabId)
          const prevIdx = (idx - 1 + prevTabs.length) % prevTabs.length
          setActiveTabId(prevTabs[prevIdx].session.id)
          return prevTabs
        })
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeys)
    return () => window.removeEventListener('keydown', handleGlobalKeys)
  }, [workspace, activeTabId, handleSplit, closeTab])

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

  useEffect(() => {
    if (activeTabId) {
      // Find the tab root layout that contains activeTabId
      let foundTabKey = activeTabId
      for (const [key, tree] of Object.entries(tabLayouts)) {
        if (JSON.stringify(tree).includes(activeTabId)) {
          foundTabKey = key
          break
        }
      }
      const activeLayout = tabLayouts[foundTabKey] ?? { type: 'leaf', sessionId: activeTabId }
      setLayoutTree((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(activeLayout)) {
          return activeLayout
        }
        return prev
      })
    } else {
      setLayoutTree(null)
    }
  }, [activeTabId, tabLayouts])

  useEffect(() => {
    if (workspace && tabs.length === 0 && !showNewTabDialog && !spawningRef.current) {
      spawningRef.current = true
      createTab('shell', 'shell').finally(() => {
        spawningRef.current = false
      })
    }
  }, [workspace, tabs.length, createTab, showNewTabDialog])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const text = e.dataTransfer.getData('text/plain')
      if (text && activeTabId) {
        window.api.session.write(activeTabId, text)
        if (text.startsWith('@')) {
          const filePath = text.substring(1)
          setSessionReferences((prev) => {
            const current = prev[activeTabId] ?? []
            if (!current.includes(filePath)) {
              return { ...prev, [activeTabId]: [...current, filePath] }
            }
            return prev
          })
        }
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
      <header className="flex h-10 items-center justify-between border-b border-border bg-[#050505] shrink-0 select-none">
        <div className="flex items-center h-full overflow-x-auto">
          {openWorkspaces.map((ws) => {
            const isActive = workspace.id === ws.id
            return (
              <div
                key={ws.id}
                className={`group flex items-center h-full gap-2 border-r border-border px-4 py-2 text-xs cursor-pointer transition-all relative ${
                  isActive
                    ? 'bg-background text-foreground font-semibold border-t-2 border-t-primary'
                    : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
                }`}
                onClick={() => {
                  if (!isActive) {
                    openWorkspace(ws)
                  }
                }}
                title={ws.rootPath}
              >
                <span className="truncate max-w-[120px]">{ws.name}</span>
                <button
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground opacity-60 group-hover:opacity-100 transition-opacity ml-1"
                  onClick={(e) => closeProjectTab(ws.id, e)}
                  title="Close Project"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
          
          <button
            className="flex items-center justify-center h-full px-3 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-r border-border"
            onClick={selectFolder}
            title="Open another project..."
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 pr-3">
          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-sm hidden md:inline">
            {workspace.rootPath}
          </span>
          <button
            className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
            onClick={() => setLeftVisible((v) => !v)}
          >
            Explorer
          </button>
          <button
            className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
            onClick={() => setRightVisible((v) => !v)}
          >
            Agents
          </button>
        </div>
      </header>

      <div className="flex h-9 items-center justify-between border-b border-border bg-[#0d0d0d] select-none">
        <div className="flex items-center h-full overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.session.id}
              className={`group relative flex h-full cursor-pointer items-center gap-2 px-4 text-xs border-r border-border/50 transition-all ${
                activeTabId === tab.session.id
                  ? 'bg-background text-foreground font-medium border-t-2 border-t-primary/80'
                  : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
              }`}
              onClick={() => setActiveTabId(tab.session.id)}
              title={tab.session.cwd ?? tab.title}
            >
              <span className="truncate max-w-[140px]">{tab.title}</span>
              <button
                className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.session.id)
                }}
                title="Close terminal tab"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            className="flex items-center justify-center h-full px-3 text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border-r border-border/50"
            onClick={() => createTab('shell', 'shell')}
            title="New terminal tab"
          >
            <Plus size={14} />
          </button>
        </div>

        {activeTabId && (
          <div className="flex items-center gap-1 px-2 shrink-0">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border border-transparent hover:border-border/50"
              onClick={() => handleSplit('vertical')}
              title="Split pane vertically (Ctrl+\\)"
            >
              <span className="font-mono text-[10px]">⬜⬜</span>
              Vertical
            </button>
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border border-transparent hover:border-border/50"
              onClick={() => handleSplit('horizontal')}
              title="Split pane horizontally (Ctrl+-)"
            >
              <span className="font-mono text-[10px]">🟰</span>
              Horizontal
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ThreeColumnLayout
          leftVisible={leftVisible}
          rightVisible={rightVisible}
          left={
            <div className="flex h-full flex-col divide-y divide-border">
              <div className="flex-grow overflow-hidden">
                <ExplorerTree
                  rootPath={workspace.rootPath}
                  onFileDrag={() => {}}
                  pinnedFiles={pinnedFiles}
                  onPinFile={handlePinFile}
                  onUnpinFile={handleUnpinFile}
                />
              </div>
              <div className="h-64 flex-shrink-0 overflow-hidden">
                <ContextPanel
                  pinnedFiles={pinnedFiles}
                  activeSessionId={activeTabId}
                  sessionReferences={activeTabId ? (sessionReferences[activeTabId] ?? []) : []}
                  onPinFile={handlePinFile}
                  onUnpinFile={handleUnpinFile}
                  onInsertReference={handleInsertReference}
                />
              </div>
            </div>
          }
          center={
            <div className="flex h-full flex-col">
              <div
                ref={terminalAreaRef}
                className="flex-1 w-full overflow-hidden"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {layoutTree ? (
                  <TerminalSplitView
                    key={workspace.id}
                    node={layoutTree}
                    activeSessionId={activeTabId}
                    onActivateSession={(id) => setActiveTabId(id)}
                    onResizePane={(updatedNode) => {
                      setLayoutTree(updatedNode)
                      if (activeTabId) {
                        setTabLayouts((prev) => {
                          const copy = { ...prev }
                          let foundTabKey = activeTabId
                          for (const [key, tree] of Object.entries(copy)) {
                            if (JSON.stringify(tree).includes(activeTabId)) {
                              foundTabKey = key
                              break
                            }
                          }
                          copy[foundTabKey] = updatedNode
                          return copy
                        })
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No active terminal. Click + to create one.
                  </div>
                )}
              </div>
              <PromptBuilderBar
                activeSessionId={activeTabId}
                pinnedFiles={pinnedFiles}
                onSendPrompt={handleSendPrompt}
              />
            </div>
          }
          right={
            <AgentManagerPanel
              sessions={tabs.map((t) => t.session)}
              activeSessionId={activeTabId}
              onSelectSession={(id) => setActiveTabId(id)}
              onCloseSession={(id) => closeTab(id)}
              onCreateSession={() => setShowNewTabDialog(true)}
              tasks={tasks}
              onAddTask={handleAddTask}
              onRenameTask={handleRenameTask}
              onRemoveTask={handleRemoveTask}
              onAssignSession={handleAssignSession}
              workspaceRootPath={workspace?.rootPath}
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

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        workspaceRootPath={workspace?.rootPath}
        sessions={tabs.map((t) => t.session)}
        tasks={tasks}
        onSelectSession={(id) => setActiveTabId(id)}
        onAddTask={handleAddTask}
        onPinFile={handlePinFile}
        onSplit={handleSplit}
        onToggleLeftSidebar={() => setLeftVisible((v) => !v)}
        onToggleRightSidebar={() => setRightVisible((v) => !v)}
        onCloseActiveSession={() => activeTabId && closeTab(activeTabId)}
        onCreateSession={(cmd, type) => createTab(cmd, type)}
      />
    </div>
  )
}
