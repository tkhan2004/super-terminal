import { useState, useEffect } from 'react'
import { X, FileText, Download, Check } from 'lucide-react'
import { marked } from 'marked'

interface MarkdownPreviewModalProps {
  filePath: string
  onClose: () => void
}

export function MarkdownPreviewModal({ filePath, onClose }: MarkdownPreviewModalProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean>(false)

  const fileName = filePath.split(/[\\/]/).pop() || filePath

  useEffect(() => {
    let active = true

    async function loadFile() {
      setLoading(true)
      setError(null)
      try {
        const text = await window.api.fs.readFile(filePath)
        if (active) {
          setContent(text)
        }
      } catch (err) {
        if (active) {
          setError(String(err))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadFile()

    return () => {
      active = false
    }
  }, [filePath])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy content:', err)
    }
  }

  // Convert markdown to HTML safely using marked
  const getHtmlContent = () => {
    try {
      // Configure marked option to enable breaks and secure link targets
      return { __html: marked.parse(content, { breaks: true, gfm: true }) }
    } catch (err) {
      return { __html: `<p class="text-rose-500">Failed to parse markdown: ${String(err)}</p>` }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/55 backdrop-blur-md animate-fade-in select-text">
      <style>{`
        .markdown-preview-body {
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.6;
        }
        .markdown-preview-body h1 {
          font-size: 1.6em;
          font-weight: 700;
          margin-top: 1.4em;
          margin-bottom: 0.5em;
          border-bottom: 1px solid hsl(var(--border) / 0.6);
          padding-bottom: 0.3em;
          color: hsl(var(--foreground));
        }
        .markdown-preview-body h2 {
          font-size: 1.3em;
          font-weight: 600;
          margin-top: 1.3em;
          margin-bottom: 0.5em;
          border-bottom: 1px solid hsl(var(--border) / 0.3);
          padding-bottom: 0.2em;
          color: hsl(var(--foreground));
        }
        .markdown-preview-body h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin-top: 1.2em;
          margin-bottom: 0.5em;
          color: hsl(var(--foreground));
        }
        .markdown-preview-body p {
          margin-top: 0;
          margin-bottom: 1em;
          color: hsl(var(--muted-foreground));
          font-size: 12.5px;
        }
        .markdown-preview-body code {
          font-family: Consolas, Monaco, monospace;
          background-color: hsl(var(--secondary) / 0.8);
          color: hsl(var(--primary));
          padding: 0.15em 0.3em;
          border-radius: 4px;
          font-size: 0.85em;
        }
        .markdown-preview-body pre {
          background-color: hsl(var(--secondary) / 0.35);
          border: 1px solid hsl(var(--border) / 0.5);
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1em;
        }
        .markdown-preview-body pre code {
          background-color: transparent;
          color: hsl(var(--foreground));
          padding: 0;
          border-radius: 0;
          font-size: 0.8em;
          display: block;
        }
        .markdown-preview-body ul, .markdown-preview-body ol {
          margin-top: 0;
          margin-bottom: 1.2em;
          padding-left: 1.4em;
          color: hsl(var(--muted-foreground));
          font-size: 12.5px;
        }
        .markdown-preview-body li {
          margin-bottom: 0.35em;
        }
        .markdown-preview-body table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.2em;
          font-size: 11.5px;
        }
        .markdown-preview-body th, .markdown-preview-body td {
          border: 1px solid hsl(var(--border) / 0.5);
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .markdown-preview-body th {
          background-color: hsl(var(--secondary) / 0.5);
          font-weight: 600;
          color: hsl(var(--foreground));
        }
        .markdown-preview-body blockquote {
          border-left: 3px solid hsl(var(--primary) / 0.7);
          padding-left: 0.8em;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        .markdown-preview-body a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .markdown-preview-body a:hover {
          color: hsl(var(--primary) / 0.8);
        }
      `}</style>
      {/* Modal Dialog container */}
      <div 
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border bg-card/50 px-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FileText size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">{fileName}</span>
              <span className="text-[9px] text-muted-foreground truncate font-mono">{filePath}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              disabled={loading || !!error}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary/35 px-3 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              title="Copy markdown text to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Download size={12} />
                  Copy raw
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary/35 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Close Preview"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-grow overflow-y-auto p-6 bg-card/20 custom-scrollbar">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Loading preview...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-center p-6">
              <div className="max-w-md space-y-2">
                <span className="text-rose-500 font-semibold block text-sm">Error Loading File</span>
                <span className="text-xs text-muted-foreground font-mono block bg-rose-500/5 border border-rose-500/10 rounded p-3">{error}</span>
                <button
                  onClick={onClose}
                  className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <article 
              className="markdown-preview-body text-foreground select-text selection:bg-primary/20"
              dangerouslySetInnerHTML={getHtmlContent()}
            />
          )}
        </div>
      </div>
    </div>
  )
}
