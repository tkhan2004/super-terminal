import { useState, useEffect, useCallback, useRef } from 'react'
import type { DirEntry, GitStatus } from '@shared/types/ipc'
import { ChevronRight, ChevronDown, File, Folder, Pin, Eye, EyeOff } from 'lucide-react'
import { MarkdownPreviewModal } from './MarkdownPreviewModal'

interface ExplorerTreeProps {
  rootPath: string
  onFileDrag: (relativePath: string) => void
  pinnedFiles: string[]
  onPinFile: (path: string) => void
  onUnpinFile: (path: string) => void
}

interface TreeNode {
  entry: DirEntry
  children: TreeNode[] | null
  expanded: boolean
  loading: boolean
}

export function ExplorerTree({
  rootPath,
  onFileDrag,
  pinnedFiles,
  onPinFile,
  onUnpinFile
}: ExplorerTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [showHidden, setShowHidden] = useState(true)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null)

  const updateGitStatus = useCallback(async () => {
    try {
      const status = await window.api.git.status(rootPath)
      setGitStatus(status)
    } catch (err) {
      console.error('Failed to load git status:', err)
    }
  }, [rootPath])

  const filterEntries = useCallback((nodes: TreeNode[]): TreeNode[] => {
    return nodes.filter(
      (node) =>
        showHidden ||
        !node.entry.name.startsWith('.') ||
        node.entry.name === '.gitignore'
    )
  }, [showHidden])
  const [watchId, setWatchId] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)
  const watchIdRef = useRef<string | null>(null)

  const loadDir = useCallback(async (path: string): Promise<DirEntry[]> => {
    return window.api.fs.readDir(path)
  }, [])

  // expandNode is no longer used recursively. We fetch directory entries asynchronously in handleToggle and apply them to the tree synchronously.

  const collapseNode = useCallback((path: string, treeNodes: TreeNode[]): TreeNode[] => {
    return treeNodes.map((node) => {
      if (node.entry.path === path) {
        return { ...node, expanded: false }
      }
      if (node.children) {
        return { ...node, children: collapseNode(path, node.children) }
      }
      return node
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      updateGitStatus()
      const entries = await loadDir(rootPath)
      if (cancelled) return
      setTree(
        entries.map((e) => ({
          entry: e,
          children: null,
          expanded: false,
          loading: false
        }))
      )

      const wId = await window.api.fs.watch(rootPath)
      if (cancelled) {
        window.api.fs.unwatch(wId)
        return
      }
      watchIdRef.current = wId
      setWatchId(wId)
    }

    init()
    return () => {
      cancelled = true
      if (watchIdRef.current) {
        window.api.fs.unwatch(watchIdRef.current)
      }
    }
  }, [rootPath, loadDir, updateGitStatus])

  useEffect(() => {
    const unsubscribe = window.api.fs.onWatchEvent((event) => {
      if (event.watchId !== watchId) return
      updateGitStatus()
      // For simplicity, reload root on any change
      loadDir(rootPath).then((entries) => {
        setTree((prev) => {
          // Preserve expanded state
          const expandedPaths = new Set<string>()
          function collectExpanded(nodes: TreeNode[]) {
            for (const node of nodes) {
              if (node.expanded) expandedPaths.add(node.entry.path)
              if (node.children) collectExpanded(node.children)
            }
          }
          collectExpanded(prev)
          return entries.map((e) => ({
            entry: e,
            children: null,
            expanded: expandedPaths.has(e.path),
            loading: false
          }))
        })
      })
    })
    return unsubscribe
  }, [watchId, rootPath, loadDir, updateGitStatus])

  const handleToggle = useCallback(
    async (node: TreeNode) => {
      if (node.expanded) {
        setTree((prev) => collapseNode(node.entry.path, prev))
      } else {
        if (node.children === null) {
          const children = await loadDir(node.entry.path)
          const updateTree = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map((n) => {
              if (n.entry.path === node.entry.path) {
                return {
                  ...n,
                  expanded: true,
                  children: children.map((c) => ({
                    entry: c,
                    children: null,
                    expanded: false,
                    loading: false
                  }))
                }
              }
              if (n.children) {
                return { ...n, children: updateTree(n.children) }
              }
              return n
            })
          }
          setTree((prev) => updateTree(prev))
        } else {
          const updateTree = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map((n) => {
              if (n.entry.path === node.entry.path) {
                return { ...n, expanded: true }
              }
              if (n.children) {
                return { ...n, children: updateTree(n.children) }
              }
              return n
            })
          }
          setTree((prev) => updateTree(prev))
        }
      }
    },
    [loadDir, collapseNode]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: DirEntry) => {
      const relativePath = entry.path.replace(rootPath, '').replace(/^[\\/]/, '')
      dragRef.current = relativePath
      e.dataTransfer.setData('text/plain', `@${relativePath}`)
      e.dataTransfer.effectAllowed = 'copy'
      onFileDrag(relativePath)
    },
    [rootPath, onFileDrag]
  )

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const indent = depth * 16
    const relativePath = node.entry.path.replace(rootPath, '').replace(/^[\\/]/, '')
    const isPinned = pinnedFiles.includes(relativePath)

    const getGitStatusColor = (nodePath: string, isDirectory: boolean) => {
      if (!gitStatus) return ''
      const rel = nodePath.replace(rootPath, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
      
      if (isDirectory) {
        const folderPrefix = rel ? rel + '/' : ''
        const hasMod = gitStatus.modified.some(p => p.startsWith(folderPrefix))
        const hasStg = gitStatus.staged.some(p => p.startsWith(folderPrefix))
        const hasUnt = gitStatus.untracked.some(p => p.startsWith(folderPrefix))
        
        if (hasMod) return 'text-amber-500 font-medium'
        if (hasStg) return 'text-sky-500 font-medium'
        if (hasUnt) return 'text-emerald-500 font-medium'
        return ''
      } else {
        if (gitStatus.modified.some(p => p === rel)) return 'text-amber-500 font-medium'
        if (gitStatus.staged.some(p => p === rel)) return 'text-sky-500 font-medium'
        if (gitStatus.untracked.some(p => p === rel)) return 'text-emerald-500 font-medium'
        return ''
      }
    }

    const getGitBadge = (nodePath: string, isDirectory: boolean) => {
      if (!gitStatus || isDirectory) return null
      const rel = nodePath.replace(rootPath, '').replace(/^[\\/]/, '').replace(/\\/g, '/')
      
      if (gitStatus.modified.some(p => p === rel)) {
        return <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-0.5 rounded font-bold" title="Modified">M</span>
      }
      if (gitStatus.staged.some(p => p === rel)) {
        return <span className="text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/20 px-0.5 rounded font-bold" title="Staged">A</span>
      }
      if (gitStatus.untracked.some(p => p === rel)) {
        return <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-0.5 rounded font-bold" title="Untracked">U</span>
      }
      return null
    }

    const statusColorClass = getGitStatusColor(node.entry.path, node.entry.isDirectory)

    return (
      <div key={node.entry.path}>
        <div
          className={`group flex min-w-0 cursor-pointer items-center justify-between gap-1 py-0.5 text-xs hover:bg-secondary/50 ${
            !node.entry.isDirectory ? 'cursor-grab' : ''
          }`}
          style={{ paddingLeft: indent + 8 }}
          onClick={() => {
            if (node.entry.isDirectory) {
              handleToggle(node)
            } else if (node.entry.name.toLowerCase().endsWith('.md')) {
              setPreviewFilePath(node.entry.path)
            }
          }}
          draggable={!node.entry.isDirectory}
          onDragStart={(e) => !node.entry.isDirectory && handleDragStart(e, node.entry)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {node.entry.isDirectory ? (
              <>
                {node.expanded ? (
                  <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                )}
                <Folder size={14} className={`shrink-0 ${statusColorClass ? statusColorClass.split(' ')[0] : 'text-blue-400'}`} />
              </>
            ) : (
              <>
                <span className="w-3 shrink-0" />
                <File size={14} className={`shrink-0 ${statusColorClass ? statusColorClass.split(' ')[0] : 'text-muted-foreground'}`} />
              </>
            )}
            <span className={`truncate ${statusColorClass}`}>{node.entry.name}</span>
          </div>
          {/* Fixed-width badge slot — always present so every row has the same layout */}
          <span className="w-5 shrink-0 flex items-center justify-center">
            {getGitBadge(node.entry.path, node.entry.isDirectory)}
          </span>
          {!node.entry.isDirectory && (
            <button
              className={`p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all shrink-0 mr-1.5 ${
                isPinned ? 'opacity-100 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (isPinned) {
                  onUnpinFile(relativePath)
                } else {
                  onPinFile(relativePath)
                }
              }}
              title={isPinned ? 'Unpin File' : 'Pin File'}
            >
              <Pin size={10} className={isPinned ? 'fill-current' : ''} />
            </button>
          )}
        </div>
        {node.expanded && node.children && (
          <div>{filterEntries(node.children).map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <button
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          onClick={() => setShowHidden(!showHidden)}
          title={showHidden ? "Hide Hidden Files" : "Show Hidden Files"}
        >
          {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        ) : (
          filterEntries(tree).map((node) => renderNode(node, 0))
        )}
      </div>
      {previewFilePath && (
        <MarkdownPreviewModal
          filePath={previewFilePath}
          onClose={() => setPreviewFilePath(null)}
        />
      )}
    </div>
  )
}
