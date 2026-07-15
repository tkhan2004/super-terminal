import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore, TERMINAL_PRESETS } from '../../stores/settingsStore'
import '@xterm/xterm/css/xterm.css'

interface UseXtermSessionOptions {
  sessionId: string
  onResize?: (cols: number, rows: number) => void
  onData?: (data: string) => void
}

export function useXtermSession({ sessionId, onResize, onData }: UseXtermSessionOptions) {
  const themeMode = useSettingsStore((state) => state.themeMode)
  const terminalAppearance = useSettingsStore((state) => state.terminalAppearance)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const appearance = terminalAppearance
    const preset = TERMINAL_PRESETS[appearance.themePreset]

    const terminal = new Terminal({
      fontSize: appearance.fontSize,
      fontFamily: appearance.fontFamily,
      cursorBlink: appearance.cursorBlink,
      cursorStyle: appearance.cursorStyle,
      allowProposedApi: true,
      theme: preset
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // React to theme preset / appearance changes live (no remount needed)
  useEffect(() => {
    if (!terminalRef.current) return
    const preset = TERMINAL_PRESETS[terminalAppearance.themePreset]
    terminalRef.current.options.theme = preset
    terminalRef.current.options.fontSize = terminalAppearance.fontSize
    terminalRef.current.options.fontFamily = terminalAppearance.fontFamily
    terminalRef.current.options.cursorBlink = terminalAppearance.cursorBlink
    terminalRef.current.options.cursorStyle = terminalAppearance.cursorStyle
    fitAddonRef.current?.fit()
  }, [terminalAppearance])

  // Also react to light/dark theme switch (apply on top of the preset background)
  useEffect(() => {
    if (!terminalRef.current) return
    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    // Only override when the user is on the 'default' preset (which has light variant)
    if (terminalAppearance.themePreset === 'default') {
      terminalRef.current.options.theme = isDark
        ? TERMINAL_PRESETS.default
        : {
            background: '#ffffff', foreground: '#0f172a', cursor: '#0f172a',
            selectionBackground: '#cbd5e1',
            black: '#0f172a', red: '#dc2626', green: '#16a34a', yellow: '#ca8a04',
            blue: '#2563eb', magenta: '#d946ef', cyan: '#0891b2', white: '#f1f5f9',
            brightBlack: '#64748b', brightRed: '#ef4444', brightGreen: '#22c55e',
            brightYellow: '#eab308', brightBlue: '#3b82f6', brightMagenta: '#f02e65',
            brightCyan: '#06b6d4', brightWhite: '#ffffff'
          }
    }
  }, [themeMode, terminalAppearance.themePreset])

  return { containerRef, write, fit, focus, terminal: terminalRef }
}
