import { create } from 'zustand'
import type { Task } from '@shared/types/task'

interface TaskStore {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  removeTask: (taskId: string) => void
  updateTaskName: (taskId: string, name: string) => void
  assignSessionToTask: (taskId: string, sessionId: string) => void
  unassignSessionFromTask: (sessionId: string) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  removeTask: (taskId) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),
  updateTaskName: (taskId, name) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, name } : t))
    })),
  assignSessionToTask: (taskId, sessionId) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        // Remove sessionId from other tasks if it exists
        const cleanedSessionIds = t.sessionIds.filter((id) => id !== sessionId)
        if (t.id === taskId) {
          return { ...t, sessionIds: [...cleanedSessionIds, sessionId] }
        }
        return { ...t, sessionIds: cleanedSessionIds }
      })
    })),
  unassignSessionFromTask: (sessionId) =>
    set((state) => ({
      tasks: state.tasks.map((t) => ({
        ...t,
        sessionIds: t.sessionIds.filter((id) => id !== sessionId)
      }))
    }))
}))
