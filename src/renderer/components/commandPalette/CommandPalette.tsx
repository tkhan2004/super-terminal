import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { Session, AgentType } from '@shared/types/session'
import type { Task } from '@shared/types/task'
import {
  Search,
  Terminal,
  Columns,
  FolderPlus,
  Pin,
  X,
  Layout,
  CornerDownLeft
} from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  workspaceRootPath?: string
  sessions: Session[]
  tasks: Task[]
  onSelectSession: (id: string) => void
  onAddTask: (name: string) => void
  onPinFile: (path: string) => void
  onSplit: (direction: 'horizontal' | 'vertical') => void
  onToggleLeftSidebar: () => void
  onToggleRightSidebar: () => void
  onCloseActiveSession: () => void
  onCreateSession: (command: string, agentType: AgentType) => void
}

interface PaletteItem {
  id: string
  title: string
  category: 'Actions' | 'Sessions' | 'Tasks' | 'Files'
  icon: React.ReactNode
  action: () => void
  filePath?: string
}

export function CommandPalette({
  isOpen,
  onClose,
  workspaceRootPath,
  sessions,
  tasks,
  onSelectSession,
  onAddTask,
  onPinFile,
  onSplit,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onCloseActiveSession,
  onCreateSession
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'commands' | 'files'>('commands')
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load files recursively when switching to files view
  useEffect(() => {
    if (viewMode === 'files' && workspaceRootPath) {
      setLoadingFiles(true)
      window.api.fs.listAllFiles(workspaceRootPath)
        .then((files) => {
          setAllFiles(files)
          setSelectedIndex(0)
        })
        .catch((err) => console.error('Failed to load files', err))
        .finally(() => setLoadingFiles(false))
    }
  }, [viewMode, workspaceRootPath])

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedIndex(0)
      setViewMode('commands')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Main Action Commands list
  const baseCommands = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      {
        id: 'split-h',
        title: 'Split Horizontally',
        category: 'Actions',
        icon: <Columns className="rotate-90 text-blue-400" size={14} />,
        action: () => {
          onSplit('horizontal')
          onClose()
        }
      },
      {
        id: 'split-v',
        title: 'Split Vertically',
        category: 'Actions',
        icon: <Columns className="text-blue-400" size={14} />,
        action: () => {
          onSplit('vertical')
          onClose()
        }
      },
      {
        id: 'close-session',
        title: 'Close Active Terminal Session',
        category: 'Actions',
        icon: <X className="text-red-400" size={14} />,
        action: () => {
          onCloseActiveSession()
          onClose()
        }
      },
      {
        id: 'toggle-left',
        title: 'Toggle Left Sidebar (File Explorer)',
        category: 'Actions',
        icon: <Layout className="text-cyan-400" size={14} />,
        action: () => {
          onToggleLeftSidebar()
          onClose()
        }
      },
      {
        id: 'toggle-right',
        title: 'Toggle Right Sidebar (Agent Workspace)',
        category: 'Actions',
        icon: <Layout className="rotate-180 text-cyan-400" size={14} />,
        action: () => {
          onToggleRightSidebar()
          onClose()
        }
      },
      {
        id: 'new-shell',
        title: 'New Session: Terminal (shell)',
        category: 'Actions',
        icon: <Terminal className="text-green-400" size={14} />,
        action: () => {
          onCreateSession('shell', 'shell')
          onClose()
        }
      },
      {
        id: 'new-claude',
        title: 'New Session: Claude Agent',
        category: 'Actions',
        icon: <Terminal className="text-orange-400" size={14} />,
        action: () => {
          onCreateSession('claude', 'claude')
          onClose()
        }
      },
      {
        id: 'new-gemini',
        title: 'New Session: Gemini Agent',
        category: 'Actions',
        icon: <Terminal className="text-purple-400" size={14} />,
        action: () => {
          onCreateSession('gemini', 'gemini')
          onClose()
        }
      },
      {
        id: 'create-task',
        title: 'Create New Task...',
        category: 'Actions',
        icon: <FolderPlus className="text-amber-400" size={14} />,
        action: () => {
          const name = prompt('Enter new task name:')
          if (name && name.trim()) {
            onAddTask(name.trim())
          }
          onClose()
        }
      }
    ]

    // Switch view command
    if (workspaceRootPath) {
      list.push({
        id: 'goto-files',
        title: 'Search & Pin Files...',
        category: 'Actions',
        icon: <Search className="text-primary" size={14} />,
        action: () => setViewMode('files')
      })
    }

    return list
  }, [onSplit, onCloseActiveSession, onToggleLeftSidebar, onToggleRightSidebar, onCreateSession, onAddTask, workspaceRootPath, onClose])

  // Combined searchable list
  const filteredItems = useMemo(() => {
    if (viewMode === 'files') {
      const q = searchQuery.toLowerCase()
      const matches = allFiles.filter((f) => f.toLowerCase().includes(q))
      return matches.map((file) => ({
        id: `file-${file}`,
        title: `Pin File: ${file.split('/').pop()}`,
        category: 'Files' as const,
        icon: <Pin className="text-primary" size={14} />,
        action: () => {
          onPinFile(file)
          onClose()
        },
        filePath: file
      }))
    }

    const q = searchQuery.toLowerCase()
    const items: PaletteItem[] = [...baseCommands]

    // Add Sessions to items
    sessions.forEach((s) => {
      items.push({
        id: `session-${s.id}`,
        title: `Switch to Session: ${s.title} (${s.agentType})`,
        category: 'Sessions',
        icon: <Terminal className="text-muted-foreground" size={14} />,
        action: () => {
          onSelectSession(s.id)
          onClose()
        }
      })
    })

    // Add Tasks to items
    tasks.forEach((t) => {
      items.push({
        id: `task-${t.id}`,
        title: `Focus Task: ${t.name}`,
        category: 'Tasks',
        icon: <FolderPlus className="text-muted-foreground" size={14} />,
        action: () => {
          // Switch to sessions tab and highlight or similar actions
          onClose()
        }
      })
    })

    return items.filter((item) => item.title.toLowerCase().includes(q))
  }, [viewMode, searchQuery, allFiles, baseCommands, sessions, tasks, onPinFile, onSelectSession, onClose])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (viewMode === 'files') {
        setViewMode('commands')
        setSearchQuery('')
      } else {
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-[2px] pt-[15vh] px-4 animate-fade-in">
      <div
        ref={containerRef}
        className="w-full max-w-xl rounded-lg border border-border bg-[#0a0a0a] shadow-2xl overflow-hidden flex flex-col max-h-[50vh]"
      >
        {/* Search Input Bar */}
        <div className="flex h-12 items-center border-b border-border px-3.5 gap-2 shrink-0">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-grow bg-transparent border-0 text-sm text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
            placeholder={
              viewMode === 'files'
                ? 'Type to fuzzy search tref and pin files...'
                : 'Type a command or session name to search...'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          {viewMode === 'files' && (
            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded font-semibold shrink-0">
              Files Mode
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-grow overflow-y-auto p-2 space-y-0.5 select-none">
          {loadingFiles ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Scanning workspace directories recursively...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No results found matching your search.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex
              const isFile = item.category === 'Files'
              const fileSubText = isFile ? item.filePath : null

              return (
                <div
                  key={item.id}
                  className={`cursor-pointer rounded-md px-3 py-2 flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary/40'
                  }`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate">{item.title}</span>
                      {fileSubText && (
                        <span className={`text-[9px] truncate font-mono mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {fileSubText}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] rounded font-semibold tracking-wider uppercase px-1.5 py-0.5 ${
                      isSelected ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {item.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft size={10} className="opacity-80" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
export type { PaletteItem }
