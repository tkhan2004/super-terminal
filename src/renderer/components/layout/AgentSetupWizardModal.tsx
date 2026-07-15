import { useState, useEffect } from 'react'
import { X, ShieldAlert, Download, Terminal } from 'lucide-react'

interface AgentSetupWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: (command: string, agentType: 'claude' | 'codex' | 'gemini' | 'shell') => void
}

interface AgentCliInfo {
  id: string
  name: string
  command: string
  npmPackage: string
  description: string
  installed: boolean
  loading: boolean
}

export function AgentSetupWizardModal({ isOpen, onClose, onCreateSession }: AgentSetupWizardModalProps) {
  const [agents, setAgents] = useState<AgentCliInfo[]>([
    {
      id: 'claude',
      name: 'Claude Code',
      command: 'claude',
      npmPackage: '@anthropic-ai/claude-code',
      description: 'Official CLI agent from Anthropic for coding and terminal operations.',
      installed: false,
      loading: true
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      command: 'codex',
      npmPackage: '@codex-space/cli',
      description: 'AI coding assistant companion running in the shell.',
      installed: false,
      loading: true
    },
    {
      id: 'antigravity',
      name: 'Antigravity CLI',
      command: 'agy',
      npmPackage: 'antigravity-cli',
      description: 'Advanced agentic coding CLI for pair programming and repository indexing.',
      installed: false,
      loading: true
    },
    {
      id: 'commandcode',
      name: 'CommandCode AI',
      command: 'commandcode',
      npmPackage: 'commandcode',
      description: 'Secure, lightweight terminal assistant for coding queries and scripting.',
      installed: false,
      loading: true
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      command: 'opencode',
      npmPackage: 'opencode-cli',
      description: 'Open-source CLI terminal agent supporting local LLM execution.',
      installed: false,
      loading: true
    }
  ])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [checking, setChecking] = useState(true)

  // Scan local PATH to check which ones are already installed
  useEffect(() => {
    if (!isOpen) return

    const scanClis = async () => {
      setChecking(true)
      const updatedAgents = await Promise.all(
        agents.map(async (agent) => {
          try {
            // Call IPC method to run where.exe/which
            const installed = await window.api.system.checkCliInstalled(agent.command)
            return { ...agent, installed, loading: false }
          } catch {
            return { ...agent, installed: false, loading: false }
          }
        })
      )

      setAgents(updatedAgents)
      setChecking(false)

      // Pre-select agents that are NOT installed
      const uninstalled = updatedAgents.filter((a) => !a.installed).map((a) => a.id)
      setSelectedIds(uninstalled)
    }

    scanClis()
  }, [isOpen])

  if (!isOpen) return null

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleInstall = () => {
    const selectedAgents = agents.filter((a) => selectedIds.includes(a.id))
    if (selectedAgents.length === 0) {
      onClose()
      return
    }

    // Build npm install command
    const packages = selectedAgents.map((a) => a.npmPackage).join(' ')
    const installCommand = `npm install -g ${packages}`

    // Trigger terminal creation with command
    onCreateSession(installCommand, 'shell')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl rounded-xl border border-border/80 bg-[#0d0d0e] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border/40 bg-card px-5">
          <div className="flex items-center gap-2">
            <Terminal className="text-primary" size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Coding Agents Installer Wizard
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Setup AI Coding Companions</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Super Terminal runs AI agents globally on your system. Select which coding agents you want to use. We will compile and install selected NPM packages in your terminal.
            </p>
          </div>

          {checking ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-2 text-xs text-muted-foreground">
              <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <span>Scanning system PATH for global CLIs...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleToggle(agent.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                    selectedIds.includes(agent.id)
                      ? 'border-primary/50 bg-primary/5 shadow-sm'
                      : 'border-border/50 bg-[#141416]/50 hover:bg-[#141416]'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(agent.id)}
                      onChange={() => {}} // handled by parent div click
                      className="rounded bg-secondary border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                      {agent.installed ? (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-medium">
                          Installed
                        </span>
                      ) : (
                        <span className="text-[9px] bg-secondary/80 text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium">
                          NPM Package
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{agent.description}</p>
                    <div className="text-[10px] font-mono text-muted-foreground/60 pt-1">
                      Package: <code className="text-foreground/70 bg-secondary/35 px-1 rounded">{agent.npmPackage}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2.5 items-center p-3 rounded-lg bg-secondary/20 border border-border/30 text-[11px] text-muted-foreground">
            <ShieldAlert size={14} className="text-amber-500 shrink-0" />
            <span>Note: Installing global npm packages requires Node.js and might require Administrator/sudo privileges depending on your environment.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3.5 bg-card">
          <button
            className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-4 py-2 text-xs flex items-center gap-1.5 shadow-lg transition-colors"
            onClick={handleInstall}
            disabled={checking || selectedIds.length === 0}
          >
            <Download size={13} />
            Install Selected ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}
