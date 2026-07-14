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
  tabLayouts?: Record<string, SplitPaneNode>
}

export type SplitPaneNode =
  | { type: 'leaf'; sessionId: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; sizes: number[]; children: SplitPaneNode[] }

import type { Task } from './task'

export interface WorkspaceState {
  workspace: Workspace
  sessions: import('./session').Session[]
  layout: WorkspaceLayout
  tasks?: Task[]
  pinnedFiles?: string[]
  timeline?: Record<string, import('./session').TimelineEvent[]>
}
