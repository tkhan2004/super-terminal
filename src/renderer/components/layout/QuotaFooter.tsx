import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore, CliQuota } from '../../stores/settingsStore'
import { Shield, Key, Database, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react'

export function QuotaFooter() {
  const { quotas, updateQuota } = useSettingsStore()
  const [activeCli, setActiveCli] = useState<string | null>(null)
  
  // Modal form states
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(0)
  const [apiKey, setApiKey] = useState('')

  const [loadingQuota, setLoadingQuota] = useState(false)

  const fetchClaudeQuota = useCallback(async () => {
    setLoadingQuota(true)
    try {
      const res = await window.api.claude.getQuota()
      if (res && res.success) {
        updateQuota('claude', {
          sessionUsed: res.sessionUsed,
          sessionReset: res.sessionReset,
          weekUsed: res.weekUsed,
          weekReset: res.weekReset
        })
      }
    } catch (err) {
      console.error('Failed to fetch Claude quota:', err)
    } finally {
      setLoadingQuota(false)
    }
  }, [updateQuota])

  useEffect(() => {
    const checkClaudeCreds = async () => {
      try {
        const creds = await window.api.claude.getCredentials()
        if (creds && creds.isLoggedIn) {
          updateQuota('claude', {
            isLoggedIn: true,
            apiKey: creds.accessToken ? creds.accessToken.substring(0, 18) + '...' : 'Authorized Oauth',
          })
          
          // Initial quota fetch
          setLoadingQuota(true)
          const res = await window.api.claude.getQuota()
          if (res && res.success) {
            updateQuota('claude', {
              sessionUsed: res.sessionUsed,
              sessionReset: res.sessionReset,
              weekUsed: res.weekUsed,
              weekReset: res.weekReset
            })
          }
          setLoadingQuota(false)
        } else {
          updateQuota('claude', {
            isLoggedIn: false,
            apiKey: ''
          })
        }
      } catch (err) {
        console.error('Failed to check Claude credentials:', err)
        setLoadingQuota(false)
      }
    }
    checkClaudeCreds()
  }, [updateQuota])

  useEffect(() => {
    if (quotas.claude.isLoggedIn) {
      const timer = setInterval(() => {
        fetchClaudeQuota()
      }, 60000)
      return () => clearInterval(timer)
    }
    return undefined
  }, [quotas.claude.isLoggedIn, fetchClaudeQuota])

  const openSettings = (key: string, quota: CliQuota) => {
    setActiveCli(key)
    setIsLoggedIn(quota.isLoggedIn)
    setUsed(quota.used)
    setLimit(quota.limit)
    setApiKey(quota.apiKey)
  }

  const handleSave = () => {
    if (activeCli) {
      updateQuota(activeCli, {
        isLoggedIn,
        used: Number(used),
        limit: Number(limit),
        apiKey
      })
      setActiveCli(null)
    }
  }

  return (
    <>
      <footer className="flex h-7 items-center justify-between border-t border-border bg-card/80 px-3 text-[11px] select-none text-muted-foreground shrink-0 z-20">
        {/* Left Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>CLI Agent Sync: Active</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1">
            <Database size={12} />
            <span>Secure Storage: AES-256</span>
          </div>
        </div>

        {/* Center Quota Statuses */}
        <div className="flex items-center gap-6">
          {Object.entries(quotas).map(([key, quota]) => {
            if (key === 'claude') {
              if (!quota.isLoggedIn) {
                return (
                  <div 
                    key={key}
                    onClick={() => openSettings(key, quota)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-secondary/40 px-2 py-0.5 rounded transition-all group"
                    title="Configure Claude CLI Credentials"
                  >
                    <span className="font-medium group-hover:text-foreground">{quota.name}:</span>
                    <span className="text-muted-foreground/60 italic flex items-center gap-1">
                      <Key size={10} />
                      Click to sign in
                    </span>
                  </div>
                )
              }

              const hasRealQuota = quota.sessionUsed !== undefined
              const sessionRemaining = hasRealQuota ? (100 - (quota.sessionUsed ?? 0)) : 100
              const weekRemaining = hasRealQuota ? (100 - (quota.weekUsed ?? 0)) : 100

              let sessionBarColor = 'bg-emerald-500'
              let sessionTextColor = 'text-emerald-500 font-semibold'
              if (quota.sessionUsed !== undefined) {
                if (quota.sessionUsed >= 80) {
                  sessionBarColor = 'bg-rose-500'
                  sessionTextColor = 'text-rose-500 font-semibold'
                } else if (quota.sessionUsed >= 50) {
                  sessionBarColor = 'bg-amber-500'
                  sessionTextColor = 'text-amber-500 font-semibold'
                }
              }

              let weekBarColor = 'bg-emerald-500'
              let weekTextColor = 'text-emerald-500 font-semibold'
              if (quota.weekUsed !== undefined) {
                if (quota.weekUsed >= 80) {
                  weekBarColor = 'bg-rose-500'
                  weekTextColor = 'text-rose-500 font-semibold'
                } else if (quota.weekUsed >= 50) {
                  weekBarColor = 'bg-amber-500'
                  weekTextColor = 'text-amber-500 font-semibold'
                }
              }

              return (
                <div 
                  key={key}
                  onClick={fetchClaudeQuota}
                  className={`flex items-center gap-3 cursor-pointer hover:bg-secondary/40 px-2 py-0.5 rounded transition-all group ${loadingQuota ? 'opacity-65' : ''}`}
                  title="Claude CLI Subscription Quota (Click to refresh)"
                >
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    {quota.name}
                    {loadingQuota && <RefreshCw size={10} className="animate-spin" />}
                  </span>
                  
                  {hasRealQuota ? (
                    <>
                      <div className="flex items-center gap-2 border-r border-border/40 pr-2">
                        <span className="text-[10px] text-muted-foreground/80">5h:</span>
                        <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full ${sessionBarColor}`} style={{ width: `${sessionRemaining}%` }} />
                        </div>
                        <span className={sessionTextColor}>{quota.sessionUsed}%</span>
                        <span className="text-[9px] text-muted-foreground/50">({quota.sessionReset})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/80">Week:</span>
                        <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full ${weekBarColor}`} style={{ width: `${weekRemaining}%` }} />
                        </div>
                        <span className={weekTextColor}>{quota.weekUsed}%</span>
                        <span className="text-[9px] text-muted-foreground/50">({quota.weekReset})</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground/50 italic">Loading usage...</span>
                  )}
                </div>
              )
            }

            const pct = quota.limit > 0 ? ((quota.limit - quota.used) / quota.limit) * 100 : 0
            const pctSafe = Math.max(0, Math.min(100, pct))
            const formattedLimit = quota.limit >= 1000000 
              ? `${(quota.limit / 1000000).toFixed(1)}M` 
              : quota.limit >= 1000 
                ? `${(quota.limit / 1000).toFixed(1)}k` 
                : quota.limit
            const formattedUsed = quota.used >= 1000000 
              ? `${(quota.used / 1000000).toFixed(1)}M` 
              : quota.used >= 1000 
                ? `${(quota.used / 1000).toFixed(1)}k` 
                : quota.used

            // Color coding progress indicator
            let barColor = 'bg-emerald-500'
            let textColor = 'text-emerald-500 font-semibold'
            if (pct < 20) {
              barColor = 'bg-rose-500'
              textColor = 'text-rose-500 font-semibold'
            } else if (pct < 50) {
              barColor = 'bg-amber-500'
              textColor = 'text-amber-500 font-semibold font-medium'
            }

            return (
              <div 
                key={key}
                onClick={() => openSettings(key, quota)}
                className="flex items-center gap-2 cursor-pointer hover:bg-secondary/40 px-2 py-0.5 rounded transition-all group"
                title={`Configure ${quota.name} Quota`}
              >
                <span className="font-medium group-hover:text-foreground">{quota.name}:</span>
                {quota.isLoggedIn ? (
                  <div className="flex items-center gap-2">
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden border border-border/55">
                      <div 
                        className={`h-full ${barColor} transition-all duration-300`} 
                        style={{ width: `${pctSafe}%` }}
                      />
                    </div>
                    <span>
                      {quota.unit === 'USD' ? '$' : ''}
                      {formattedUsed}/{formattedLimit} {quota.unit !== 'USD' ? quota.unit : ''} 
                      <span className={`ml-1 ${textColor}`}>({pctSafe.toFixed(0)}%)</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60 italic flex items-center gap-1">
                    <Key size={10} />
                    Click to sign in
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Right Info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <RefreshCw size={11} className={`${loadingQuota ? 'animate-spin' : ''}`} />
            <span>CLI Real-time Sync Active</span>
          </div>
        </div>
      </footer>

      {/* Quota Configuration Modal */}
      {activeCli && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-lg border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="text-primary" size={16} />
                <h3 className="text-sm font-semibold text-foreground">
                  Configure {quotas[activeCli].name}
                </h3>
              </div>
              <button 
                onClick={() => setActiveCli(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {activeCli === 'claude' ? (
              <div className="space-y-4 text-xs">
                {/* Connection Status */}
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="font-medium text-foreground">Auth Method:</span>
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Claude Code OAuth
                  </span>
                </div>

                {/* 5-Hour Session Info */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium">
                    <span className="text-foreground">5-Hour Rate Limit Usage:</span>
                    <span className="text-primary font-bold">{quotas.claude.sessionUsed ?? 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/50">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${quotas.claude.sessionUsed ?? 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-between">
                    <span>Resets in:</span>
                    <span className="font-mono font-medium text-foreground">{quotas.claude.sessionReset ?? 'Unknown'}</span>
                  </div>
                </div>

                {/* Weekly Info */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-foreground">Weekly Rate Limit Usage (All Models):</span>
                    <span className="text-amber-500 font-bold">{quotas.claude.weekUsed ?? 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/55">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${quotas.claude.weekUsed ?? 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground flex justify-between">
                    <span>Resets in:</span>
                    <span className="font-mono font-medium text-foreground">{quotas.claude.weekReset ?? 'Unknown'}</span>
                  </div>
                </div>

                {/* Info Tip */}
                <div className="bg-secondary/35 border border-border/50 p-2.5 rounded text-[10px] leading-relaxed text-muted-foreground">
                  These limits are computed based on local sessions on this machine as configured by Anthropic. They do not include usage on other devices or web interfaces.
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button 
                    onClick={() => {
                      fetchClaudeQuota()
                    }}
                    disabled={loadingQuota}
                    className="flex-1 rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-65"
                  >
                    <RefreshCw size={12} className={loadingQuota ? 'animate-spin' : ''} />
                    Refresh Quota
                  </button>
                  <button 
                    onClick={() => setActiveCli(null)}
                    className="flex-1 rounded bg-secondary py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Login Status */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Login Status:</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isLoggedIn} 
                      onChange={(e) => {
                        setIsLoggedIn(e.target.checked)
                        if (!e.target.checked) {
                          setUsed(0)
                        } else {
                          setUsed(quotas[activeCli].used)
                        }
                      }} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted-foreground after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-checked:after:bg-primary-foreground"></div>
                    <span className="ml-2 text-xs">
                      {isLoggedIn ? 'Signed In' : 'Signed Out'}
                    </span>
                  </label>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">API Key / Token:</span>
                    {isLoggedIn && apiKey && (
                      <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </div>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={isLoggedIn ? "Enter API Key" : "Not signed in"}
                    disabled={!isLoggedIn}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>

                {/* Usage Stats (Only if logged in) */}
                {isLoggedIn && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="font-medium text-foreground">Used ({quotas[activeCli].unit}):</span>
                      <input 
                        type="number" 
                        value={used}
                        onChange={(e) => setUsed(Number(e.target.value))}
                        className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="font-medium text-foreground">Limit ({quotas[activeCli].unit}):</span>
                      <input 
                        type="number" 
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Warnings / Tips */}
                {isLoggedIn && used >= limit && (
                  <div className="flex items-start gap-2 rounded bg-rose-500/10 border border-rose-500/20 p-2.5 text-[10px] text-rose-500">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>Quota completely exhausted! Please upgrade or increase the limit.</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-5 pt-3 border-t border-border">
                  <button 
                    onClick={handleSave}
                    className="flex-1 rounded bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors"
                  >
                    Save Configuration
                  </button>
                  <button 
                    onClick={() => setActiveCli(null)}
                    className="flex-1 rounded bg-secondary py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
