import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const checkClaudeCreds = async () => {
      try {
        const creds = await window.api.claude.getCredentials()
        if (creds && creds.isLoggedIn) {
          updateQuota('claude', {
            isLoggedIn: true,
            apiKey: creds.accessToken ? creds.accessToken.substring(0, 18) + '...' : 'Authorized Oauth',
          })
        } else {
          updateQuota('claude', {
            isLoggedIn: false,
            apiKey: ''
          })
        }
      } catch (err) {
        console.error('Failed to check Claude credentials:', err)
      }
    }
    checkClaudeCreds()
  }, [updateQuota])

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
            <RefreshCw size={11} className="animate-spin-slow" />
            <span>Simulated Usage Tracker</span>
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
            </div>

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
        </div>
      )}
    </>
  )
}
