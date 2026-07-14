import type { TerminalApi } from '../preload/index'

declare global {
  interface Window {
    api: TerminalApi
  }
}

export {}
