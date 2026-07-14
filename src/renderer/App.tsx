import { useState, useCallback, useEffect, useRef } from 'react'
import type { Workspace } from '@shared/types/workspace'
import { WorkspacePane } from './components/layout/WorkspacePane'
import { useSettingsStore } from './stores/settingsStore'
import { X, Plus, Sun, Moon, Monitor } from 'lucide-react'

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [openWorkspaces, setOpenWorkspaces] = useState<Workspace[]>([])
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>([])
  const onSaveStateRef = useRef<Record<string, () => Promise<void>>>({})

  const { themeMode, setThemeMode } = useSettingsStore()

  const cycleTheme = useCallback(() => {
    if (themeMode === 'dark') setThemeMode('light')
    else if (themeMode === 'light') setThemeMode('system')
    else setThemeMode('dark')
  }, [themeMode, setThemeMode])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateTheme = () => {
      const isDark = 
        themeMode === 'dark' || 
        (themeMode === 'system' && mediaQuery.matches)
      
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    updateTheme()

    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
    return undefined
  }, [themeMode])

  const loadWorkspacesList = useCallback(async () => {
    const list = await window.api.workspace.list()
    setWorkspacesList(list)
  }, [])

  useEffect(() => {
    loadWorkspacesList()
  }, [loadWorkspacesList])

  const openWorkspace = useCallback(async (ws: Workspace) => {
    try {
      if (workspace && onSaveStateRef.current[workspace.id]) {
        await onSaveStateRef.current[workspace.id]()
      }

      setOpenWorkspaces((prev) => {
        if (prev.some((w) => w.id === ws.id)) return prev
        return [...prev, ws]
      })

      setWorkspace(ws)
    } catch (err) {
      console.error('[Renderer] Error in openWorkspace:', err)
    }
  }, [workspace])

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
        if (workspace && onSaveStateRef.current[workspace.id]) {
          await onSaveStateRef.current[workspace.id]()
        }
        setWorkspace(ws)
        setOpenWorkspaces((prev) => {
          if (prev.some((w) => w.id === ws.id)) return prev
          return [...prev, ws]
        })
      }
    } catch (err) {
      console.error('[Renderer] Error in selectFolder:', err)
    }
  }, [workspace, openWorkspace])

  const closeProjectTab = useCallback(async (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const wsToClose = openWorkspaces.find((w) => w.id === wsId)
    if (!wsToClose) return

    if (onSaveStateRef.current[wsId]) {
      await onSaveStateRef.current[wsId]()
    }

    const remaining = openWorkspaces.filter((w) => w.id !== wsId)
    setOpenWorkspaces(remaining)

    if (workspace && workspace.id === wsId) {
      if (remaining.length > 0) {
        setWorkspace(remaining[remaining.length - 1])
      } else {
        setWorkspace(null)
      }
    }
  }, [workspace, openWorkspaces])

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <header className="flex h-10 items-center justify-between border-b border-border bg-card shrink-0 select-none">
        <div className="flex items-center h-full overflow-x-auto">
          {openWorkspaces.map((ws) => {
            const isActive = workspace?.id === ws.id
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
          {workspace && (
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-sm hidden md:inline">
              {workspace.rootPath}
            </span>
          )}
          <button
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
            onClick={cycleTheme}
            title={`Theme: ${themeMode.toUpperCase()} (Click to cycle)`}
          >
            {themeMode === 'light' ? <Sun size={14} /> : themeMode === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {openWorkspaces.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-background text-foreground p-6">
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
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Recent Workspaces
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {workspacesList.map((ws) => (
                      <div
                        key={ws.id}
                        className="group flex items-center justify-between rounded border border-border bg-secondary/10 p-2.5 hover:border-primary/50 hover:bg-secondary/20 transition-all cursor-pointer"
                        onClick={() => openWorkspace(ws)}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-semibold text-foreground truncate">{ws.name}</span>
                          <span className="text-[9px] text-muted-foreground truncate font-mono">{ws.rootPath}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          openWorkspaces.map((ws) => {
            const isActive = workspace?.id === ws.id
            return (
              <div
                key={ws.id}
                className={`h-full w-full ${isActive ? 'block' : 'hidden'}`}
              >
                <WorkspacePane
                  workspace={ws}
                  isActive={isActive}
                  onSaveStateRef={onSaveStateRef}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
