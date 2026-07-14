import { create } from 'zustand'
import type { Session, SessionStatus } from '@shared/types/session'

interface SessionStore {
  sessionsByWorkspace: Record<string, Session[]>
  activeSessionId: string | null
  statusBySessionId: Record<string, SessionStatus>
  setSessions: (workspaceId: string, sessions: Session[]) => void
  setActiveSession: (id: string | null) => void
  setSessionStatus: (sessionId: string, status: SessionStatus) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionsByWorkspace: {},
  activeSessionId: null,
  statusBySessionId: {},
  setSessions: (workspaceId: string, sessions: Session[]) =>
    set((state) => ({
      sessionsByWorkspace: { ...state.sessionsByWorkspace, [workspaceId]: sessions }
    })),
  setActiveSession: (id: string | null) => set({ activeSessionId: id }),
  setSessionStatus: (sessionId: string, status: SessionStatus) =>
    set((state) => ({
      statusBySessionId: { ...state.statusBySessionId, [sessionId]: status }
    }))
}))
