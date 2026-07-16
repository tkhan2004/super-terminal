import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Workspace, WorkspaceLayout, SplitPaneNode } from '@shared/types/workspace'
import type { Session, AgentType } from '@shared/types/session'
import { ThreeColumnLayout } from './ThreeColumnLayout'
import { AgentManagerPanel } from '../agentManager/AgentManagerPanel'
import { ExplorerTree } from '../explorer/ExplorerTree'
import { TerminalSplitView } from '../terminal/TerminalSplitView'
import { ContextPanel } from '../explorer/ContextPanel'
import { CommandPalette } from '../commandPalette/CommandPalette'
import { useTaskStore } from '../../stores/taskStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { X, Plus, Download } from 'lucide-react'
import { AgentSetupWizardModal } from './AgentSetupWizardModal'

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

function collectSessionIds(node: SplitPaneNode, ids: string[] = []): string[] {
  if (node.type === 'leaf') {
    if (node.sessionId) ids.push(node.sessionId)
  } else {
    for (const child of node.children) {
      collectSessionIds(child, ids)
    }
  }
  return ids
}

interface TerminalTab {
  session: Session
  title: string
}

interface WorkspacePaneProps {
  workspace: Workspace
  isActive: boolean
  onSaveStateRef: React.MutableRefObject<Record<string, () => Promise<void>>>
}

const isMac = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

export function WorkspacePane({ workspace, isActive, onSaveStateRef }: WorkspacePaneProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [newCommand, setNewCommand] = useState('shell')
  const [showNewTabDialog, setShowNewTabDialog] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [showNewTabMenu, setShowNewTabMenu] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [leftVisible, setLeftVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)
  const terminalAreaRef = useRef<HTMLDivElement>(null)


  const {
    addTask,
    removeTask,
    updateTaskName,
    assignSessionToTask,
    unassignSessionFromTask
  } = useTaskStore()
  const allTasks = useTaskStore((state) => state.tasks)
  const tasks = allTasks.filter((t) => t.workspaceId === workspace.id)

  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])
  const [sessionReferences, setSessionReferences] = useState<Record<string, string[]>>({})
  const [tabLayouts, setTabLayouts] = useState<Record<string, SplitPaneNode>>({})
  const [isRestored, setIsRestored] = useState(false)

  const activeTabRootId = activeTabId ? (() => {
    for (const [key, tree] of Object.entries(tabLayouts)) {
      if (JSON.stringify(tree).includes(activeTabId)) {
        return key
      }
    }
    return activeTabId
  })() : null

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
      workspaceId: workspace.id,
      name,
      sessionIds: [],
      createdAt: Date.now()
    })
  }, [workspace.id, addTask])

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


  const createTab = useCallback(
    async (command: string, agentType: AgentType) => {
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
    [workspace.id, workspace.rootPath, setNewCommand, setTabLayouts]
  )

  const closeTabOrPane = useCallback(
    async (id: string, isTabClose: boolean = false) => {
      let sessionIdsToKill: string[] = []
      if (isTabClose) {
        const tree = tabLayouts[id]
        if (tree) {
          sessionIdsToKill = collectSessionIds(tree)
        } else {
          sessionIdsToKill = [id]
        }
      } else {
        sessionIdsToKill = [id]
      }

      await Promise.all(sessionIdsToKill.map(sid => window.api.session.kill(sid).catch(() => {})))

      setTabs((prev) => prev.filter((t) => !sessionIdsToKill.includes(t.session.id)))

      setTabLayouts((prev) => {
        const copy = { ...prev }
        if (isTabClose) {
          delete copy[id]
        } else {
          for (const [key, tree] of Object.entries(copy)) {
            const updated = removeLeaf(tree, id)
            if (updated) {
              copy[key] = updated
            } else {
              delete copy[key]
            }
          }
          delete copy[id]
        }
        return copy
      })

      setActiveTabId((currentActiveId) => {
        if (!currentActiveId || sessionIdsToKill.includes(currentActiveId)) {
          const remainingRootKeys = Object.keys(tabLayouts).filter(k => k !== (isTabClose ? id : ''))
          if (remainingRootKeys.length > 0) {
            const nextRootKey = remainingRootKeys[remainingRootKeys.length - 1]
            const tree = tabLayouts[nextRootKey]
            if (tree) {
              const ids = collectSessionIds(tree)
              return ids.length > 0 ? ids[0] : nextRootKey
            }
            return nextRootKey
          }
          return null
        }
        return currentActiveId
      })
    },
    [tabLayouts]
  )

  const closeTab = useCallback(
    (sessionId: string) => {
      closeTabOrPane(sessionId, false)
    },
    [closeTabOrPane]
  )

  const saveState = useCallback(async () => {
    if (tabs.length === 0) return

    const activeLayout = activeTabRootId ? tabLayouts[activeTabRootId] : null
    const layout: WorkspaceLayout = {
      workspaceId: workspace.id,
      windowBounds: { x: 100, y: 100, width: 1280, height: 800 },
      splitPaneTree: activeLayout ?? { type: 'leaf', sessionId: activeTabId ?? '' },
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
  }, [workspace, tabs, activeTabId, activeTabRootId, tasks, pinnedFiles, tabLayouts])

  // Register saveState ref to parent App
  useEffect(() => {
    onSaveStateRef.current[workspace.id] = saveState
    return () => {
      delete onSaveStateRef.current[workspace.id]
    }
  }, [workspace.id, saveState, onSaveStateRef])

  // Show agent installer wizard on first run (onboarding)
  useEffect(() => {
    const onboardingShown = localStorage.getItem('super-terminal-setup-wizard-shown')
    if (!onboardingShown) {
      localStorage.setItem('super-terminal-setup-wizard-shown', 'true')
      setTimeout(() => setShowSetupWizard(true), 1500)
    }
  }, [])

  // Restore workspace state on mount
  useEffect(() => {
    const restoreWorkspace = async () => {
      try {
        const state = await window.api.workspace.restore(workspace.id)
        if (state) {
          setTabs(state.sessions.map((s) => ({ session: s, title: s.title })))
          setActiveTabId(state.layout.activeSessionId)
          setPinnedFiles(state.pinnedFiles ?? [])
          
          let restoredTabLayouts = state.layout.tabLayouts ?? {}
          if (Object.keys(restoredTabLayouts).length === 0 && state.sessions.length > 0) {
            restoredTabLayouts = {}
            for (const s of state.sessions) {
              restoredTabLayouts[s.id] = { type: 'leaf', sessionId: s.id }
            }
          }
          setTabLayouts(restoredTabLayouts)
          if (state.timeline) {
            useTimelineStore.getState().setWorkspaceEvents({
              ...useTimelineStore.getState().events,
              ...state.timeline
            })
          }
        } else {
          setTabs([])
          setActiveTabId(null)
          setPinnedFiles([])
          setTabLayouts({})
        }
      } catch (err) {
        console.error('Failed to restore workspace:', err)
      } finally {
        setIsRestored(true)
      }
    }
    restoreWorkspace()
  }, [workspace.id])

  const spawningRef = useRef(false)



  useEffect(() => {
    if (isRestored && workspace && tabs.length === 0 && !showNewTabDialog && !spawningRef.current) {
      spawningRef.current = true
      createTab('shell', 'shell').finally(() => {
        spawningRef.current = false
      })
    }
  }, [isRestored, workspace, tabs.length, createTab, showNewTabDialog])

  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  // Cleanup on unmount (kills sessions when workspace tab is closed)
  useEffect(() => {
    return () => {
      tabsRef.current.forEach((tab) => {
        window.api.session.kill(tab.session.id).catch(() => {})
      })
    }
  }, [])

  // Auto-save logic
  useEffect(() => {
    if (tabs.length > 0) {
      const timer = setTimeout(() => {
        saveState()
      }, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [tabs, activeTabId, pinnedFiles, tabLayouts, saveState])
  const handleSplit = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (!activeTabId || !workspace) return

      let cols = 80
      let rows = 24
      if (terminalAreaRef.current) {
        const width = terminalAreaRef.current.clientWidth
        const height = terminalAreaRef.current.clientHeight
        cols = Math.max(80, Math.floor(width / 8.5))
        rows = Math.max(24, Math.floor(height / 18))
      }

      window.api.session
        .create({
          workspaceId: workspace.id,
          command: 'shell',
          cwd: workspace.rootPath,
          agentType: 'shell',
          title: 'Terminal',
          cols,
          rows
        })
        .then((session) => {
          const tab: TerminalTab = { session, title: session.title }
          setTabs((prev) => [...prev, tab])

          setTabLayouts((prev) => {
            const copy = { ...prev }
            let foundTabKey = activeTabId
            for (const [key, tree] of Object.entries(copy)) {
              if (JSON.stringify(tree).includes(activeTabId)) {
                foundTabKey = key
                break
              }
            }

            const currentTree = copy[foundTabKey]
            if (currentTree) {
              copy[foundTabKey] = splitLeaf(
                currentTree,
                activeTabId,
                session.id,
                direction
              )
            } else {
              copy[foundTabKey] = { type: 'leaf', sessionId: session.id }
            }

            return copy
          })

          setActiveTabId(session.id)
        })
        .catch((err) => console.error('Failed to split terminal:', err))
    },
    [activeTabId, workspace, setTabLayouts]
  )

  // Keyboard shortcut listener (declared after closeTabOrPane and handleSplit dependencies)
  useEffect(() => {
    if (!isActive) return undefined

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey
      const key = e.key.toLowerCase()

      if (isCtrl && key === 'p') {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
      } else if (isCtrl && key === '\\') {
        e.preventDefault()
        handleSplit('vertical')
      } else if (isCtrl && isShift && (key === '-' || key === '_')) {
        e.preventDefault()
        handleSplit('horizontal')
      } else if (isCtrl && isShift && (key === 'w' || key === 'q')) {
        e.preventDefault()
        if (activeTabId) {
          closeTabOrPane(activeTabId, false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, activeTabId, tabLayouts, closeTabOrPane, handleSplit])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const text = e.dataTransfer.getData('text/plain')
      if (text && text.startsWith('@') && activeTabId) {
        window.api.session.write(activeTabId, text + ' ')
      }
    },
    [activeTabId]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex h-9 items-center justify-between border-b border-border bg-secondary/40 select-none">
        <div className="flex items-center h-full flex-1 min-w-0">
          <div className="flex items-center h-full overflow-x-auto">
            {Object.keys(tabLayouts).map((tabRootId) => {
              const tabSession = tabs.find((t) => t.session.id === tabRootId)?.session
              if (!tabSession) return null
              const title = tabSession.title || tabSession.command

              let isTabActive = activeTabId === tabRootId
              if (activeTabId && tabLayouts[tabRootId]) {
                isTabActive = JSON.stringify(tabLayouts[tabRootId]).includes(activeTabId)
              }

              return (
                <div
                  key={tabRootId}
                  className={`group relative flex h-full cursor-pointer items-center gap-2 px-4 text-xs border-r border-border/50 transition-all ${
                    isTabActive
                      ? 'bg-background text-foreground font-medium border-t-2 border-t-primary/80'
                      : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
                  }`}
                  onClick={() => {
                    const tree = tabLayouts[tabRootId]
                    if (tree) {
                      const sessionIds = collectSessionIds(tree)
                      if (sessionIds.length > 0) {
                        if (activeTabId && sessionIds.includes(activeTabId)) {
                          setActiveTabId(activeTabId)
                        } else {
                          setActiveTabId(sessionIds[0])
                        }
                      } else {
                        setActiveTabId(tabRootId)
                      }
                    } else {
                      setActiveTabId(tabRootId)
                    }
                  }}
                  title={tabSession.cwd ?? title}
                >
                  <span className="truncate max-w-[140px]">{title}</span>
                  <button
                    className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTabOrPane(tabRootId, true)
                    }}
                    title="Close terminal tab"
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="relative h-full flex items-center shrink-0">
            <button
              className="flex items-center justify-center h-full px-3 text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border-r border-border/50"
              onClick={() => setShowNewTabMenu((v) => !v)}
              title="New terminal tab..."
            >
              <Plus size={14} />
            </button>

            {showNewTabMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowNewTabMenu(false)} 
                />
                <div className="absolute top-full left-0 mt-1 w-44 rounded-md border border-border bg-card py-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <button
                    onClick={() => {
                      createTab('shell', 'shell')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    🖥️ Terminal (Shell)
                  </button>
                  <div className="border-t border-border/40 my-1" />
                  <button
                    onClick={() => {
                      createTab('claude', 'claude')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    🤖 Claude Agent
                  </button>
                  <button
                    onClick={() => {
                      createTab('codex', 'codex')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    💻 Codex Agent
                  </button>
                  <button
                    onClick={() => {
                      createTab('9router', 'opencode')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    🌐 Opencode Agent
                  </button>
                  <button
                    onClick={() => {
                      createTab('commandcode', 'commandcodeai')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    ⚡ Commandcodeai Agent
                  </button>
                  <button
                    onClick={() => {
                      createTab('agy', 'antigravity')
                      setShowNewTabMenu(false)
                    }}
                    className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    🛸 Antigravity Agent
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {activeTabId && (
          <div className="flex items-center gap-1 px-2 shrink-0">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border border-transparent hover:border-border/50"
              onClick={() => handleSplit('vertical')}
              title={isMac ? "Split pane vertically (⌘\\)" : "Split pane vertically (Ctrl+\\)"}
            >
              <span className="font-mono text-[10px]">⬜⬜</span>
              Vertical
            </button>
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/20 hover:text-foreground transition-colors border border-transparent hover:border-border/50"
              onClick={() => handleSplit('horizontal')}
              title={isMac ? "Split pane horizontally (⌘Shift-)" : "Split pane horizontally (Ctrl+Shift+-)"}
            >
              <span className="font-mono text-[10px]">🟰</span>
              Horizontal
            </button>
          </div>
        )}
      </div>

      {/* Main three column layout */}
      <div className="flex-1 overflow-hidden">
        <ThreeColumnLayout
          leftVisible={leftVisible}
          rightVisible={rightVisible}
          left={
            <div className="flex h-full flex-col divide-y divide-border bg-card">
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
                className="flex-1 w-full overflow-hidden bg-background"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {Object.keys(tabLayouts).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-background">
                    No active terminal. Click + to create one.
                  </div>
                ) : (
                  Object.entries(tabLayouts).map(([tabRootId, tree]) => {
                    const isTabActive = activeTabRootId === tabRootId
                    return (
                      <div
                        key={tabRootId}
                        className={`h-full w-full ${isTabActive ? '' : 'hidden'}`}
                      >
                        <TerminalSplitView
                          node={tree}
                          activeSessionId={activeTabId}
                          onActivateSession={(id) => setActiveTabId(id)}
                          onResizePane={(updatedNode) => {
                            setTabLayouts((prev) => ({
                              ...prev,
                              [tabRootId]: updatedNode
                            }))
                          }}
                        />
                      </div>
                    )
                  })
                )}
              </div>
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
              workspaceRootPath={workspace.rootPath}
            />
          }
        />
      </div>

      {/* New tab dialog */}
      {showNewTabDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
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
            <div className="mt-4 border-t border-border pt-3 flex flex-col gap-1.5">
              <span className="text-[10px] text-muted-foreground text-left">Or setup coding companions:</span>
              <button
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border/80 bg-secondary/20 hover:bg-secondary/40 py-1.5 text-xs text-foreground transition-all"
                onClick={() => {
                  setShowNewTabDialog(false)
                  setShowSetupWizard(true)
                }}
              >
                <Download size={12} className="text-primary" /> Setup Coding Agents...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coding Agents Setup Wizard Modal */}
      <AgentSetupWizardModal
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onCreateSession={(cmd) => createTab(cmd, 'shell')}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        workspaceRootPath={workspace.rootPath}
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
