import React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { TerminalPane } from './TerminalPane'
import type { SplitPaneNode } from '@shared/types/workspace'

interface TerminalSplitViewProps {
  node: SplitPaneNode
  activeSessionId: string | null
  onActivateSession: (id: string) => void
  onResizePane?: (node: SplitPaneNode) => void
}

export function TerminalSplitView({
  node,
  activeSessionId,
  onActivateSession,
  onResizePane
}: TerminalSplitViewProps) {
  if (node.type === 'leaf') {
    if (!node.sessionId) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground bg-background">
          No active session
        </div>
      )
    }
    return (
      <div
        className={`h-full w-full border ${
          activeSessionId === node.sessionId ? 'border-primary' : 'border-transparent'
        }`}
      >
        <TerminalPane
          key={node.sessionId}
          sessionId={node.sessionId}
          isActive={activeSessionId === node.sessionId}
          onActivate={() => onActivateSession(node.sessionId)}
        />
      </div>
    )
  }

  const handleLayoutChange = (sizes: number[]) => {
    if (onResizePane) {
      onResizePane({
        ...node,
        sizes
      })
    }
  }

  return (
    <PanelGroup
      direction={node.direction}
      className="h-full w-full"
      onLayout={handleLayoutChange}
    >
      {node.children.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <PanelResizeHandle
              className={`bg-border hover:bg-primary/50 transition-colors ${
                node.direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
              }`}
            />
          )}
          <Panel defaultSize={node.sizes[index] ?? 100 / node.children.length}>
            <TerminalSplitView
              node={child}
              activeSessionId={activeSessionId}
              onActivateSession={onActivateSession}
              onResizePane={(updatedChild) => {
                if (onResizePane) {
                  const newChildren = [...node.children]
                  newChildren[index] = updatedChild
                  onResizePane({
                    ...node,
                    children: newChildren
                  })
                }
              }}
            />
          </Panel>
        </React.Fragment>
      ))}
    </PanelGroup>
  )
}
