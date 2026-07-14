import { app } from 'electron'
import { join } from 'node:path'
import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'

class Logger {
  private logFilePath: string

  constructor() {
    // In dev mode, we can use app.getPath('userData') or fallback to current dir if not ready
    let userDataPath: string
    try {
      userDataPath = app.getPath('userData')
    } catch {
      userDataPath = '.'
    }
    
    const logsDir = join(userDataPath, 'logs')
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    
    this.logFilePath = join(logsDir, 'app.log')
    this.rotateLogIfTooLarge()
    this.info('=== logger Initialized ===')
  }

  private rotateLogIfTooLarge() {
    try {
      if (existsSync(this.logFilePath)) {
        const stats = statSync(this.logFilePath)
        // Rotate if log file is larger than 5MB
        if (stats.size > 5 * 1024 * 1024) {
          const rotatedPath = `${this.logFilePath}.old`
          writeFileSync(rotatedPath, readFileSync(this.logFilePath))
          writeFileSync(this.logFilePath, '')
          this.info('Log file rotated due to size limit (5MB)')
        }
      }
    } catch (err) {
      console.error('Failed to rotate log file:', err)
    }
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, error?: unknown) {
    const timestamp = new Date().toISOString()
    let logMsg = `[${timestamp}] [${level}] ${message}\n`
    if (error) {
      if (error instanceof Error) {
        logMsg += `  Stack: ${error.stack}\n`
      } else {
        logMsg += `  Error: ${JSON.stringify(error)}\n`
      }
    }

    // Print to process console in dev
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      if (level === 'ERROR') console.error(logMsg.trim())
      else if (level === 'WARN') console.warn(logMsg.trim())
      else console.log(logMsg.trim())
    }

    try {
      appendFileSync(this.logFilePath, logMsg)
    } catch (err) {
      console.error('Failed to write to log file:', err)
    }
  }

  info(message: string) {
    this.log('INFO', message)
  }

  warn(message: string) {
    this.log('WARN', message)
  }

  error(message: string, error?: unknown) {
    this.log('ERROR', message, error)
  }
}

export const logger = new Logger()
