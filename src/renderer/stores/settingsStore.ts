import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ITheme } from '@xterm/xterm'

export type ThemeMode = 'light' | 'dark' | 'system'

export type CursorStyle = 'block' | 'bar' | 'underline'
export type ThemePreset = 'default' | 'dracula' | 'nord' | 'monokai' | 'solarized'

export interface TerminalAppearance {
  fontFamily: string
  fontSize: number
  cursorStyle: CursorStyle
  cursorBlink: boolean
  themePreset: ThemePreset
}

export const TERMINAL_PRESETS: Record<ThemePreset, ITheme> = {
  default: {
    background: '#0a0a0a', foreground: '#e4e4e4', cursor: '#e4e4e4',
    selectionBackground: '#264f78',
    black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
    blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
    brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
    brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
    brightCyan: '#29b8db', brightWhite: '#e5e5e5'
  },
  dracula: {
    background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  nord: {
    background: '#2e3440', foreground: '#d8dee9', cursor: '#d8dee9',
    selectionBackground: '#4c566a',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb', brightWhite: '#eceff4'
  },
  monokai: {
    background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0',
    selectionBackground: '#49483e',
    black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
    blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
    brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e',
    brightYellow: '#f4bf75', brightBlue: '#66d9ef', brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4', brightWhite: '#f9f8f5'
  },
  solarized: {
    background: '#002b36', foreground: '#839496', cursor: '#839496',
    selectionBackground: '#073642',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
    brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
  }
}

export const DEFAULT_TERMINAL_APPEARANCE: TerminalAppearance = {
  fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  themePreset: 'default'
}

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
  terminalAppearance: TerminalAppearance
  setTerminalAppearance: (appearance: Partial<TerminalAppearance>) => void
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
      })),
      terminalAppearance: DEFAULT_TERMINAL_APPEARANCE,
      setTerminalAppearance: (partial) => set((state) => ({
        terminalAppearance: { ...state.terminalAppearance, ...partial }
      }))
    }),
    {
      name: 'super-terminal-settings'
    }
  )
)
