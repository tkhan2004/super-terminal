import React, { useState } from 'react'
import { Pin, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ContextPanelProps {
  pinnedFiles: string[]
  activeSessionId: string | null
  sessionReferences: string[] // List of file paths referenced in the active session
  onPinFile: (path: string) => void
  onUnpinFile: (path: string) => void
  onInsertReference?: (path: string) => void
}

export function ContextPanel({
  pinnedFiles,
  activeSessionId,
  sessionReferences,
  onPinFile,
  onUnpinFile,
  onInsertReference
}: ContextPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const text = e.dataTransfer.getData('text/plain')
    if (text && text.startsWith('@')) {
      const relativePath = text.substring(1)
      onPinFile(relativePath)
    }
  }

  return (
    <div
      className={`flex h-full flex-col bg-card border-t border-border transition-colors ${
        isDragOver ? 'bg-primary/5 border-primary/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex h-10 items-center justify-between border-b border-border px-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Pin size={12} className="text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Context Panel
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Drop files here to pin
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {pinnedFiles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <span className="text-[10px] text-muted-foreground max-w-[180px]">
              No context files pinned. Drag files from Explorer or click Pin icons to add context.
            </span>
          </div>
        ) : (
          pinnedFiles.map((filePath) => {
            const isReferenced = sessionReferences.includes(filePath)
            const fileName = filePath.split(/[\\/]/).pop() || filePath

            return (
              <div
                key={filePath}
                className="group flex items-center justify-between rounded border border-border/50 bg-secondary/5 p-2 hover:bg-secondary/15 hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => onInsertReference?.(filePath)}
                title="Click to insert file reference into active terminal"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-medium truncate text-foreground">{fileName}</span>
                  <span className="text-[9px] text-muted-foreground truncate font-mono">{filePath}</span>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {activeSessionId && (
                    isReferenced ? (
                      <span
                        className="flex items-center gap-1 text-[9px] text-green-400 font-medium bg-green-500/10 rounded-full px-1.5 py-0.5 shrink-0"
                        title="Referenced (dragged) in this session"
                      >
                        <CheckCircle2 size={8} /> Ref
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-[9px] text-amber-500 font-medium bg-amber-500/10 rounded-full px-1.5 py-0.5 shrink-0"
                        title="Not yet referenced in this session"
                      >
                        <AlertCircle size={8} /> Pending
                      </span>
                    )
                  )}
                  <button
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary/35 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onUnpinFile(filePath)}
                    title="Unpin file"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
