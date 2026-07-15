import { spawn, IPty } from 'node-pty'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { AgentType, SessionStatus } from '@shared/types/session'

export interface PtySessionOptions {
  id?: string
  command: string
  cwd: string
  agentType?: AgentType
  title?: string
  cols?: number
  rows?: number
}

export interface PtySessionEvents {
  data: (data: string) => void
  exit: (exitCode: number, signal?: number) => void
}

const FLUSH_INTERVAL_MS = 16
const MAX_BUFFER_SIZE = 64 * 1024

export class PtySession extends EventEmitter {
  readonly id: string
  readonly command: string
  readonly cwd: string
  readonly agentType: AgentType
  readonly title: string
  readonly createdAt: number

  private pty: IPty
  private buffer = ''
  private flushTimer: NodeJS.Timeout | null = null
  private status: SessionStatus = 'running'
  private exitCode: number | undefined
  private exited = false
  private isFallback = false

  constructor(options: PtySessionOptions) {
    super()
    this.id = options.id ?? randomUUID()
    this.command = options.command
    this.cwd = options.cwd
    this.agentType = options.agentType ?? 'shell'
    this.title = options.title ?? options.command
    this.createdAt = Date.now()

    const shell = this.resolveShell(options.command)
    const args = this.resolveShellArgs(options.command)

    this.pty = spawn(shell, args, {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: process.env as Record<string, string>
    })

    this.pty.onData((data) => this.handleData(data))
    this.pty.onExit(({ exitCode, signal }) => this.handleExit(exitCode, signal))
  }

  private resolveShell(command: string): string {
    if (process.platform === 'win32') {
      const comspec = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe'
      const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

      if (!command || command === 'shell') {
        return powershell
      }

      // For agent commands, wrap via cmd.exe so PATH resolution works
      return comspec
    }

    // Unix
    if (!command || command === 'shell') {
      return process.env.SHELL || '/bin/bash'
    }
    return process.env.SHELL || '/bin/bash'
  }

  private resolveShellArgs(command: string): string[] {
    if (!command || command === 'shell') {
      return []
    }

    if (process.platform === 'win32') {
      // Wrap agent commands: cmd /c <command>
      return ['/c', command]
    }

    // Unix: run the command via login shell
    return ['-c', command]
  }

  private handleData(data: string): void {
    this.buffer += data

    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.flush()
      return
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS)
    }
  }

  private flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.buffer.length > 0) {
      this.emit('data', this.buffer)
      this.buffer = ''
    }
  }

  private handleExit(exitCode: number, signal?: number): void {
    const elapsed = Date.now() - this.createdAt
    
    // If it exited with non-zero code immediately (within 4 seconds) and it's not already a fallback
    if (exitCode !== 0 && elapsed < 4000 && !this.isFallback && this.command !== 'shell') {
      this.isFallback = true
      this.exited = false
      this.status = 'running'
      this.exitCode = undefined

      let installCmd = ''
      if (this.command.includes('claude')) {
        installCmd = 'npm install -g @anthropic-ai/claude-code'
      } else if (this.command.includes('codex')) {
        if (process.platform === 'win32') {
          installCmd = 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"'
        } else {
          installCmd = 'curl -fsSL https://chatgpt.com/codex/install.sh | sh'
        }
      } else if (this.command.includes('9router')) {
        installCmd = 'npm install -g 9router'
      } else if (this.command.includes('opencode')) {
        if (process.platform === 'win32') {
          installCmd = 'npm install -g opencode-ai'
        } else {
          installCmd = 'curl -fsSL https://opencode.ai/install | bash'
        }
      } else if (this.command.includes('commandcode')) {
        installCmd = 'npm install -g commandcode'
      } else if (this.command.includes('agy') || this.command.includes('antigravity')) {
        installCmd = 'agy install'
      }

      let errorMsg = `\r\n\x1b[31;1mError: Command '${this.command}' failed to start or exited immediately (code ${exitCode}).\x1b[0m\r\n`
      if (installCmd) {
        errorMsg += `\x1b[33mIf this CLI agent is not installed or configured, you can install it using:\x1b[0m\r\n`
        errorMsg += `  \x1b[36m${installCmd}\x1b[0m\r\n\r\n`
      } else {
        errorMsg += `\x1b[33mPlease check that the executable is installed and available in your PATH.\x1b[0m\r\n\r\n`
      }
      errorMsg += `\x1b[32m[Super Terminal] Fallback interactive shell started. You can run commands or troubleshoot below:\x1b[0m\r\n\r\n`

      this.emit('data', errorMsg)

      const fallbackShell = process.platform === 'win32' 
        ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        : (process.env.SHELL || '/bin/bash')

      try {
        this.pty = spawn(fallbackShell, [], {
          name: 'xterm-256color',
          cols: this.pty.cols,
          rows: this.pty.rows,
          cwd: this.cwd,
          env: process.env as Record<string, string>
        })

        this.pty.onData((data) => this.handleData(data))
        this.pty.onExit(({ exitCode, signal }) => this.handleExit(exitCode, signal))
        return
      } catch (err) {
        this.emit('data', `\r\nFailed to start fallback shell: ${String(err)}\r\n`)
      }
    }

    this.exited = true
    this.exitCode = exitCode
    this.status = 'exited'
    this.flush()
    this.emit('exit', exitCode, signal)
  }

  write(data: string): void {
    if (!this.exited) {
      this.pty.write(data)
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.exited) {
      this.pty.resize(cols, rows)
    }
  }

  kill(): void {
    if (!this.exited) {
      try {
        this.pty.kill()
      } catch {
        // process may have already exited
      }
    }
    this.flush()
  }

  getStatus(): SessionStatus {
    return this.status
  }

  getExitCode(): number | undefined {
    return this.exitCode
  }

  isExited(): boolean {
    return this.exited
  }

  dispose(): void {
    this.kill()
    this.flush()
    this.removeAllListeners()
  }
}
