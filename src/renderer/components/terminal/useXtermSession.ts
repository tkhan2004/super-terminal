import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/settingsStore'
import '@xterm/xterm/css/xterm.css'

interface UseXtermSessionOptions {
  sessionId: string
  onResize?: (cols: number, rows: number) => void
  onData?: (data: string) => void
}

export function useXtermSession({ sessionId, onResize, onData }: UseXtermSessionOptions) {
  const themeMode = useSettingsStore((state) => state.themeMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      fontSize: 14,
      fontFamily: 'Cascadia Code, Consolas, "Courier New", monospace',
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e4',
        cursor: '#e4e4e4',
        selectionBackground: '#264f78'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.open(containerRef.current)

    // Intercept keyboard shortcuts for copy/paste
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true

      const isCtrl = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey
      const key = e.key.toLowerCase()

      // Copy: Ctrl+C (when selection exists) or Ctrl+Shift+C
      if ((isCtrl && key === 'c' && terminal.hasSelection()) || (isCtrl && isShift && key === 'c')) {
        const selection = terminal.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
        }
        return false
      }

      // Paste: Ctrl+V or Ctrl+Shift+V
      if ((isCtrl && key === 'v') || (isCtrl && isShift && key === 'v')) {
        navigator.clipboard.readText().then((text) => {
          terminal.paste(text)
        })
        return false
      }

      return true
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    fitAddon.fit()

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      onResize?.(terminal.cols, terminal.rows)
    })
    resizeObserver.observe(containerRef.current)

    const dataDisposable = terminal.onData((data) => {
      onData?.(data)
    })

    return () => {
      resizeObserver.disconnect()
      dataDisposable.dispose()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, onResize, onData])

  const write = useCallback((data: string) => {
    terminalRef.current?.write(data)
  }, [])

  const fit = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit()
      onResize?.(terminalRef.current.cols, terminalRef.current.rows)
    }
  }, [onResize])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return

    const isDark = 
      themeMode === 'dark' || 
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    terminalRef.current.options.theme = isDark
      ? {
          background: '#0a0a0a',
          foreground: '#e4e4e4',
          cursor: '#e4e4e4',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        }
      : {
          background: '#ffffff',
          foreground: '#0f172a',
          cursor: '#0f172a',
          selectionBackground: '#cbd5e1',
          black: '#0f172a',
          red: '#dc2626',
          green: '#16a34a',
          yellow: '#ca8a04',
          blue: '#2563eb',
          magenta: '#d946ef',
          cyan: '#0891b2',
          white: '#f1f5f9',
          brightBlack: '#64748b',
          brightRed: '#ef4444',
          brightGreen: '#22c55e',
          brightYellow: '#eab308',
          brightBlue: '#3b82f6',
          brightMagenta: '#f02e65',
          brightCyan: '#06b6d4',
          brightWhite: '#ffffff'
        }
  }, [themeMode])

  return { containerRef, write, fit, focus, terminal: terminalRef }
}
