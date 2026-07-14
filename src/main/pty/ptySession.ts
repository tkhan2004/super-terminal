import { spawn, IPty } from 'node-pty'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { AgentType, SessionStatus } from '@shared/types/session'

export interface PtySessionOptions {
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

  constructor(options: PtySessionOptions) {
    super()
    this.id = randomUUID()
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
    if (command && command !== 'shell') {
      return command
    }
    return process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
  }

  private resolveShellArgs(command: string): string[] {
    if (!command || command === 'shell') {
      return []
    }
    return []
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
