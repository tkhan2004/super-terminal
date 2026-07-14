import { useState, useEffect, useCallback, useRef } from 'react'
import type { DirEntry } from '@shared/types/ipc'
import { ChevronRight, ChevronDown, File, Folder, Pin } from 'lucide-react'

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
  }, [rootPath, loadDir])

  useEffect(() => {
    const unsubscribe = window.api.fs.onWatchEvent((event) => {
      if (event.watchId !== watchId) return
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
  }, [watchId, rootPath, loadDir])

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

    return (
      <div key={node.entry.path}>
        <div
          className={`group flex cursor-pointer items-center justify-between gap-1 py-0.5 text-xs hover:bg-secondary/50 ${
            !node.entry.isDirectory ? 'cursor-grab' : ''
          }`}
          style={{ paddingLeft: indent + 8 }}
          onClick={() => node.entry.isDirectory && handleToggle(node)}
          draggable={!node.entry.isDirectory}
          onDragStart={(e) => !node.entry.isDirectory && handleDragStart(e, node.entry)}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {node.entry.isDirectory ? (
              <>
                {node.expanded ? (
                  <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                )}
                <Folder size={14} className="shrink-0 text-blue-400" />
              </>
            ) : (
              <>
                <span className="w-3" />
                <File size={14} className="shrink-0 text-muted-foreground" />
              </>
            )}
            <span className="truncate">{node.entry.name}</span>
          </div>
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
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  )
}
