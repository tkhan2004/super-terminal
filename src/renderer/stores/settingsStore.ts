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
  fableUsed?: number
  fiveHourUsed?: number
  fiveHourCap?: number
  fiveHourReset?: string
  weeklyUsed?: number
  weeklyCap?: number
  weeklyReset?: string
}

interface SettingsState {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  quotas: Record<string, CliQuota>
  updateQuota: (cliKey: string, quota: Partial<CliQuota>) => void
}

const defaultQuotas: Record<string, CliQuota> = {
  claude: {
    name: 'Claude',
    isLoggedIn: true,
    used: 0,
    limit: 100,
    unit: '%',
    apiKey: ''
  },
  codex: {
    name: 'Codex',
    isLoggedIn: false,
    used: 0,
    limit: 18,
    unit: 'USD',
    apiKey: ''
  },
  antigravity: {
    name: 'Antigravity',
    isLoggedIn: true,
    used: 320,
    limit: 2000,
    unit: 'Queries',
    apiKey: ''
  },
  commandcodeai: {
    name: 'Commandcodeai',
    isLoggedIn: false,
    used: 0,
    limit: 20,
    unit: 'USD',
    apiKey: ''
  },
  opencode: {
    name: 'Opencode',
    isLoggedIn: false,
    used: 0,
    limit: 50,
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
