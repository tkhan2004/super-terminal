import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface UseXtermSessionOptions {
  sessionId: string
  onResize?: (cols: number, rows: number) => void
  onData?: (data: string) => void
}

export function useXtermSession({ sessionId, onResize, onData }: UseXtermSessionOptions) {
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
    fitAddonRef.current?.fit()
  }, [])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  return { containerRef, write, fit, focus, terminal: terminalRef }
}
