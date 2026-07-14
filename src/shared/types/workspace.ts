export interface Workspace {
  id: string
  name: string
  rootPath: string
  createdAt: number
  lastActiveAt: number
}

export interface WorkspaceLayout {
  workspaceId: string
  windowBounds: { x: number; y: number; width: number; height: number }
  splitPaneTree: SplitPaneNode
  activeSessionId: string | null
}

export type SplitPaneNode =
  | { type: 'leaf'; sessionId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; sizes: number[]; children: SplitPaneNode[] }

export interface WorkspaceState {
  workspace: Workspace
  sessions: import('./session').Session[]
  layout: WorkspaceLayout
}
