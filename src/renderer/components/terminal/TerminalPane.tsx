import { useEffect, useCallback } from 'react'
import { useXtermSession } from './useXtermSession'
import { useTimelineStore } from '../../stores/timelineStore'

interface TerminalPaneProps {
  sessionId: string
  isActive: boolean
  onActivate: () => void
}

export function TerminalPane({ sessionId, isActive, onActivate }: TerminalPaneProps) {
  const processStreamData = useTimelineStore((state) => state.processStreamData)

  const handleData = useCallback(
    (data: string) => {
      window.api.session.write(sessionId, data)
    },
    [sessionId]
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      window.api.session.resize(sessionId, cols, rows)
    },
    [sessionId]
  )

  const { containerRef, write, focus, fit } = useXtermSession({
    sessionId,
    onResize: handleResize,
    onData: handleData
  })

  useEffect(() => {
    const unsubscribe = window.api.session.onData((event) => {
      if (event.sessionId === sessionId) {
        write(event.data)
        processStreamData(sessionId, event.data)
      }
    })
    return unsubscribe
  }, [sessionId, write, processStreamData])

  useEffect(() => {
    const unsubscribe = window.api.session.onExit((event) => {
      if (event.sessionId === sessionId) {
        write(`\r\n[Process exited with code ${event.exitCode}]\r\n`)
      }
    })
    return unsubscribe
  }, [sessionId, write])

  useEffect(() => {
    if (isActive) {
      fit()
      focus()
    }
  }, [isActive, focus, fit])

  return (
    <div
      className="h-full w-full bg-[#0a0a0a]"
      ref={containerRef}
      onClick={onActivate}
    />
  )
}
