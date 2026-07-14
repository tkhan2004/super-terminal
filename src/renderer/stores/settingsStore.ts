import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface CliQuota {
  name: string
  isLoggedIn: boolean
  used: number
  limit: number
  unit: string // 'Tokens' | 'Chars' | 'USD'
  apiKey: string
  sessionUsed?: number
  sessionReset?: string
  weekUsed?: number
  weekReset?: string
}

interface SettingsState {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  quotas: Record<string, CliQuota>
  updateQuota: (cliKey: string, quota: Partial<CliQuota>) => void
}

const defaultQuotas: Record<string, CliQuota> = {
  claude: {
    name: 'Claude CLI',
    isLoggedIn: true,
    used: 15420,
    limit: 100000,
    unit: 'Tokens',
    apiKey: 'sk-ant-************'
  },
  gemini: {
    name: 'Gemini CLI',
    isLoggedIn: true,
    used: 421000,
    limit: 5000000,
    unit: 'Chars',
    apiKey: 'AIzaSy************'
  },
  codex: {
    name: 'Codex CLI',
    isLoggedIn: false,
    used: 0,
    limit: 18,
    unit: 'USD',
    apiKey: ''
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'dark',
      setThemeMode: (themeMode) => set({ themeMode }),
      quotas: defaultQuotas,
      updateQuota: (cliKey, updated) => set((state) => ({
        quotas: {
          ...state.quotas,
          [cliKey]: {
            ...state.quotas[cliKey],
            ...updated
          }
        }
      }))
    }),
    {
      name: 'super-terminal-settings'
    }
  )
)
