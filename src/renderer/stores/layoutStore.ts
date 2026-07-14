import { create } from 'zustand'
import type { SplitPaneNode } from '@shared/types/workspace'

interface LayoutStore {
  splitPaneTree: SplitPaneNode | null
  activePaneId: string | null
  setSplitPaneTree: (tree: SplitPaneNode) => void
  setActivePane: (id: string | null) => void
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  splitPaneTree: null,
  activePaneId: null,
  setSplitPaneTree: (tree) => set({ splitPaneTree: tree }),
  setActivePane: (id) => set({ activePaneId: id })
}))
