interface ExplorerPlaceholderProps {
  workspaceName: string
  rootPath: string
}

export function ExplorerPlaceholder({ workspaceName, rootPath }: ExplorerPlaceholderProps) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-10 items-center border-b border-border px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
      </div>
      <div className="flex-1 p-3">
        <div className="text-sm font-medium">{workspaceName}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground" title={rootPath}>
          {rootPath}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          File tree coming in Phase 3
        </div>
      </div>
    </div>
  )
}
