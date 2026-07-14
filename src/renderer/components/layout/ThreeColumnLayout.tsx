import type { ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface ThreeColumnLayoutProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  leftVisible: boolean
  rightVisible: boolean
}

export function ThreeColumnLayout({
  left,
  center,
  right,
  leftVisible,
  rightVisible
}: ThreeColumnLayoutProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full w-full">
      {leftVisible && (
        <>
          <Panel defaultSize={18} minSize={12} maxSize={30}>
            {left}
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
        </>
      )}
      <Panel minSize={30}>{center}</Panel>
      {rightVisible && (
        <>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
          <Panel defaultSize={22} minSize={15} maxSize={35}>
            {right}
          </Panel>
        </>
      )}
    </PanelGroup>
  )
}
