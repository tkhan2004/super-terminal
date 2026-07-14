import { create } from 'zustand'
import type { Workspace } from '@shared/types/workspace'

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspace: (id: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id })
}))
