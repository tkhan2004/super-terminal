import { PtySession, type PtySessionOptions } from './ptySession'

export class PtyManager {
  private sessions = new Map<string, PtySession>()

  createSession(options: PtySessionOptions): PtySession {
    const session = new PtySession(options)
    this.sessions.set(session.id, session)
    return session
  }

  getSession(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  write(id: string, data: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.write(data)
    return true
  }

  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.resize(cols, rows)
    return true
  }

  kill(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.kill()
    return true
  }

  dispose(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.dispose()
      this.sessions.delete(id)
    }
  }

  disposeAll(): void {
    for (const session of this.sessions.values()) {
      session.dispose()
    }
    this.sessions.clear()
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys())
  }
}

export const ptyManager = new PtyManager()
