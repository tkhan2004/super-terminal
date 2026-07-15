import { create } from 'zustand'

// Strip ANSI/VT escape sequences and other control characters from terminal output
// so detection regexes can match against clean text
function stripAnsi(str: string): string {
  return str
    // ESC [ sequences (CSI): colors, cursor movement, etc.
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    // ESC ] sequences (OSC): window title, hyperlinks, etc.
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // ESC ( charset designation
    .replace(/\x1b[()][AB012]/g, '')
    // Other ESC sequences (single char)
    .replace(/\x1b[=>MH]/g, '')
    // Lone ESC
    .replace(/\x1b/g, '')
    // Other control characters (except newline \x0a and carriage return \x0d)
    .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

export interface TimelineEvent {
  id: string
  sessionId: string
  type: 'prompt' | 'command' | 'git_commit' | 'test_runner' | 'shell_prompt' | 'generic'
  title: string
  timestamp: number
  description?: string
  status?: 'success' | 'failure' | 'pending' | 'info'
}

interface TimelineState {
  events: Record<string, TimelineEvent[]> // sessionId -> events
  sessionBuffers: Record<string, string>  // sessionId -> sliding text buffer for parsing
  addEvent: (sessionId: string, event: Omit<TimelineEvent, 'id' | 'sessionId' | 'timestamp'>) => void
  clearEvents: (sessionId: string) => void
  processStreamData: (sessionId: string, data: string) => void
  setWorkspaceEvents: (events: Record<string, TimelineEvent[]>) => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: {},
  sessionBuffers: {},

  setWorkspaceEvents: (events) => set({ events }),

  addEvent: (sessionId, eventData) => {
    const newEvent: TimelineEvent = {
      ...eventData,
      id: crypto.randomUUID(),
      sessionId,
      timestamp: Date.now()
    }

    set((state) => {
      const currentEvents = state.events[sessionId] ?? []
      
      // Prevent duplicate consecutive shell prompt events
      if (
        eventData.type === 'shell_prompt' &&
        currentEvents.length > 0 &&
        currentEvents[currentEvents.length - 1].type === 'shell_prompt'
      ) {
        return state
      }

      const nextEvents = [...currentEvents, newEvent]
      if (nextEvents.length > 500) {
        nextEvents.shift()
      }

      return {
        events: {
          ...state.events,
          [sessionId]: nextEvents
        }
      }
    })
  },

  clearEvents: (sessionId) => {
    set((state) => ({
      events: {
        ...state.events,
        [sessionId]: []
      }
    }))
  },

  processStreamData: (sessionId, data) => {
    set((state) => {
      const currentBuffer = state.sessionBuffers[sessionId] ?? ''
      // Keep last 4000 characters for analysis
      let newBuffer = currentBuffer + data
      if (newBuffer.length > 4000) {
        newBuffer = newBuffer.slice(newBuffer.length - 4000)
      }

      return {
        sessionBuffers: {
          ...state.sessionBuffers,
          [sessionId]: newBuffer
        }
      }
    })

    const buffer = get().sessionBuffers[sessionId] ?? ''
    const cleanBuffer = stripAnsi(buffer)

    // 1. Detect Shell Prompt Idle (command finished)
    // Heuristics for PowerShell (PS C:\path>), Command Prompt (C:\path>), Bash/Zsh
    const psPromptRegex = /PS\s+[A-Za-z]:[\\][^>]*>\s*$|>\s*$|\$\s*$/m
    const cmdPromptRegex = /[A-Za-z]:\\[^>]*>\s*$/
    const bashPromptRegex = /([\w~-]+@[\w-]+:[^$#]*[$#]\s*$)|(\w+@\w+:[^$#]*[$#]\s*$)/
    // We only trigger shell_prompt if it's at the very end of the buffer
    if (psPromptRegex.test(cleanBuffer) || cmdPromptRegex.test(cleanBuffer) || bashPromptRegex.test(cleanBuffer)) {
      get().addEvent(sessionId, {
        type: 'shell_prompt',
        title: 'Terminal Idle (Ready)',
        description: 'Command finished executing. Shell prompt is ready.',
        status: 'success'
      })
    }

    // 2. Detect Git Commit Outputs
    // Example: [main a4670ae] feat(explorer)...
    const gitCommitRegex = new RegExp('\\[(master|main|[a-zA-Z0-9_\\-/]+)\\s+([0-9a-f]{7,40})\\]\\s+(.*)', 'i')
    const gitCommitMatch = cleanBuffer.match(gitCommitRegex)
    if (gitCommitMatch) {
      const branch = gitCommitMatch[1]
      const sha = gitCommitMatch[2]
      const msg = gitCommitMatch[3].trim()
      
      const currentEvents = get().events[sessionId] ?? []
      const hasDuplicate = currentEvents.some(
        (e) => e.type === 'git_commit' && e.description?.includes(sha)
      )

      if (!hasDuplicate) {
        get().addEvent(sessionId, {
          type: 'git_commit',
          title: `Git Commit [${branch} ${sha}]`,
          description: `Committed successfully: "${msg}" (SHA: ${sha})`,
          status: 'info'
        })
      }
    }

    // 3. Detect Test Runner Outputs (Jest / Vitest / Playwright)
    // Example: PASS  src/App.test.tsx
    if (cleanBuffer.includes('PASS  ') && !cleanBuffer.includes('PASS   detected')) {
      const passLines = cleanBuffer.split('\n').filter(line => line.includes('PASS  '))
      if (passLines.length > 0) {
        const latestPass = passLines[passLines.length - 1].trim()
        const currentEvents = get().events[sessionId] ?? []
        const hasDuplicate = currentEvents.some(
          (e) => e.type === 'test_runner' && e.title === latestPass
        )

        if (!hasDuplicate) {
          get().addEvent(sessionId, {
            type: 'test_runner',
            title: latestPass,
            description: 'Test file compiled and executed successfully.',
            status: 'success'
          })
        }
      }
    }

    // Example: FAIL  src/App.test.tsx
    if (cleanBuffer.includes('FAIL  ')) {
      const failLines = cleanBuffer.split('\n').filter(line => line.includes('FAIL  '))
      if (failLines.length > 0) {
        const latestFail = failLines[failLines.length - 1].trim()
        const currentEvents = get().events[sessionId] ?? []
        const hasDuplicate = currentEvents.some(
          (e) => e.type === 'test_runner' && e.title === latestFail
        )

        if (!hasDuplicate) {
          get().addEvent(sessionId, {
            type: 'test_runner',
            title: latestFail,
            description: 'Test file execution failed.',
            status: 'failure'
          })
        }
      }
    }
  }
}))
