import { useState } from 'react'
import { useSettingsStore, TERMINAL_PRESETS, ThemePreset, CursorStyle } from '../../stores/settingsStore'
import { X, Sparkles, Sliders, Type, Keyboard } from 'lucide-react'

interface TerminalAppearanceModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TerminalAppearanceModal({ isOpen, onClose }: TerminalAppearanceModalProps) {
  const { terminalAppearance, setTerminalAppearance } = useSettingsStore()

  // Local state so changes can be previewed before saving or saved instantly.
  // We'll save instantly on change since useSettingsStore state updates all terminals live!
  const [fontFamily, setFontFamily] = useState(terminalAppearance.fontFamily)
  const [fontSize, setFontSize] = useState(terminalAppearance.fontSize)
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>(terminalAppearance.cursorStyle)
  const [cursorBlink, setCursorBlink] = useState(terminalAppearance.cursorBlink)
  const [themePreset, setThemePreset] = useState<ThemePreset>(terminalAppearance.themePreset)

  if (!isOpen) return null

  const handlePresetChange = (preset: ThemePreset) => {
    setThemePreset(preset)
    setTerminalAppearance({ themePreset: preset })
  }

  const handleFontFamilyChange = (family: string) => {
    setFontFamily(family)
    setTerminalAppearance({ fontFamily: family })
  }

  const handleFontSizeChange = (size: number) => {
    const validSize = Math.max(8, Math.min(32, size))
    setFontSize(validSize)
    setTerminalAppearance({ fontSize: validSize })
  }

  const handleCursorStyleChange = (style: CursorStyle) => {
    setCursorStyle(style)
    setTerminalAppearance({ cursorStyle: style })
  }

  const handleCursorBlinkChange = (blink: boolean) => {
    setCursorBlink(blink)
    setTerminalAppearance({ cursorBlink: blink })
  }

  const activeTheme = TERMINAL_PRESETS[themePreset]

  // Render cursor style character simulator
  const getCursorChar = () => {
    if (cursorStyle === 'block') return '█'
    if (cursorStyle === 'underline') return '_'
    return '│'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl rounded-xl border border-border bg-[#0d0d0e] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Customization Controls */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto border-b md:border-b-0 md:border-r border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="text-primary" size={16} />
              <h2 className="text-sm font-semibold text-foreground">Terminal Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Theme Preset */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={11} /> Theme Preset
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(TERMINAL_PRESETS) as ThemePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetChange(preset)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border text-left capitalize transition-all ${
                      themePreset === preset
                        ? 'border-primary bg-primary/10 text-foreground font-semibold'
                        : 'border-border/60 bg-secondary/10 text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
                    }`}
                  >
                    <span>{preset}</span>
                    <span 
                      className="w-3.5 h-3.5 rounded-full border border-border/50 shadow-sm shrink-0" 
                      style={{ backgroundColor: TERMINAL_PRESETS[preset].background }} 
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Font Config */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Type size={11} /> Typography
              </label>
              
              <div className="flex gap-3">
                {/* Font Family Selection */}
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-muted-foreground">Font Family</span>
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full bg-[#18181b] border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="Cascadia Code, Consolas, 'Courier New', monospace">Cascadia Code</option>
                    <option value="Fira Code, Consolas, monospace">Fira Code</option>
                    <option value="Consolas, 'Courier New', monospace">Consolas</option>
                    <option value="monospace">System Monospace</option>
                  </select>
                </div>

                {/* Font Size Selector */}
                <div className="w-24 space-y-1">
                  <span className="text-[10px] text-muted-foreground">Size (px)</span>
                  <input
                    type="number"
                    min="8"
                    max="32"
                    value={fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="w-full bg-[#18181b] border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Cursor Config */}
            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Keyboard size={11} /> Cursor Options
              </label>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Style</span>
                  <select
                    value={cursorStyle}
                    onChange={(e) => handleCursorStyleChange(e.target.value as CursorStyle)}
                    className="w-full bg-[#18181b] border border-border/60 rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="block">Block (█)</option>
                    <option value="bar">Bar (│)</option>
                    <option value="underline">Underline (_)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="cursorBlink"
                    checked={cursorBlink}
                    onChange={(e) => handleCursorBlinkChange(e.target.checked)}
                    className="rounded bg-[#18181b] border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="cursorBlink" className="text-xs text-muted-foreground cursor-pointer select-none">
                    Blink Cursor
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Live Preview & Save Panel */}
        <div className="w-full md:w-80 p-6 flex flex-col justify-between bg-black/40">
          <div className="hidden md:flex justify-between items-center mb-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Dummy Live Terminal Preview */}
          <div 
            className="flex-1 rounded-lg border border-border/80 p-4 font-mono text-[13px] leading-relaxed shadow-inner overflow-hidden min-h-[160px] flex flex-col justify-between"
            style={{
              backgroundColor: activeTheme.background,
              color: activeTheme.foreground,
              fontFamily: fontFamily,
              fontSize: `${fontSize}px`
            }}
          >
            <div className="space-y-1 flex-1">
              <div className="opacity-55 text-[9px] border-b border-border/20 pb-1 mb-2 font-sans text-right select-none" style={{ color: activeTheme.foreground }}>
                preview: {themePreset} • {fontSize}px
              </div>
              <div className="whitespace-nowrap overflow-hidden">
                <span className="opacity-50" style={{ color: activeTheme.cyan ?? '#2aa198' }}>~$</span> git status
              </div>
              <div className="whitespace-nowrap overflow-hidden" style={{ color: activeTheme.green ?? '#859900' }}>
                On branch master
              </div>
              <div className="whitespace-nowrap overflow-hidden" style={{ color: activeTheme.red ?? '#dc322f' }}>
                Changes not staged for commit:
              </div>
              <div className="whitespace-nowrap overflow-hidden pl-4" style={{ color: activeTheme.red ?? '#dc322f' }}>
                modified:   src/App.tsx
              </div>
              <div className="whitespace-nowrap overflow-hidden">
                <span className="opacity-50" style={{ color: activeTheme.cyan ?? '#2aa198' }}>~$</span> npm run dev
              </div>
              <div className="flex items-center gap-0.5 whitespace-nowrap overflow-hidden">
                <span className="opacity-50" style={{ color: activeTheme.cyan ?? '#2aa198' }}>~$</span> build complete
                <span 
                  className={`inline-block select-none font-bold ${cursorBlink ? 'animate-pulse' : ''}`}
                  style={{ color: activeTheme.cursor ?? activeTheme.foreground }}
                >
                  {getCursorChar()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-0 pt-4 border-t border-border/40 flex justify-end">
            <button
              onClick={onClose}
              className="w-full rounded-md bg-primary hover:bg-primary/95 text-primary-foreground font-semibold py-2 text-xs transition-colors shadow-lg"
            >
              Apply &amp; Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
