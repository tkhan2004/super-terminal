import React, { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, X, CornerDownLeft } from 'lucide-react'

interface PromptBuilderBarProps {
  activeSessionId: string | null
  pinnedFiles: string[]
  onSendPrompt: (text: string, attachedFiles: string[]) => void
}

export function PromptBuilderBar({
  activeSessionId,
  pinnedFiles,
  onSendPrompt
}: PromptBuilderBarProps) {
  const [inputText, setInputText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  
  // Autocomplete state
  const [autocompleteQuery, setAutocompleteQuery] = useState<string | null>(null)
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSend = () => {
    if (!activeSessionId) return
    if (!inputText.trim() && attachedFiles.length === 0) return

    onSendPrompt(inputText, attachedFiles)
    setInputText('')
    setAttachedFiles([])
    setAutocompleteQuery(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If autocomplete is active
    if (autocompleteQuery !== null && filteredPinnedFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex((prev) => (prev + 1) % filteredPinnedFiles.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex((prev) => (prev - 1 + filteredPinnedFiles.length) % filteredPinnedFiles.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertAutocomplete(filteredPinnedFiles[autocompleteIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setAutocompleteQuery(null)
        return
      }
    }

    // Standard Send on Enter (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputText(value)

    const selectionStart = e.target.selectionStart
    const textBeforeCursor = value.slice(0, selectionStart)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex !== -1 && atIndex >= textBeforeCursor.length - 30) {
      const query = textBeforeCursor.slice(atIndex + 1)
      // Check if there is no space between @ and cursor
      if (!query.includes(' ')) {
        setAutocompleteQuery(query)
        setAutocompleteIndex(0)
        
        return
      }
    }
    setAutocompleteQuery(null)
  }

  const insertAutocomplete = (filePath: string) => {
    if (!textareaRef.current) return
    const value = inputText
    const selectionStart = textareaRef.current.selectionStart
    const textBeforeCursor = value.slice(0, selectionStart)
    const textAfterCursor = value.slice(selectionStart)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex !== -1) {
      const newText = textBeforeCursor.slice(0, atIndex) + `@${filePath} ` + textAfterCursor
      setInputText(newText)
      setAutocompleteQuery(null)
      
      // Reset focus and cursor position after render
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newCursorPos = atIndex + filePath.length + 2 // +2 for @ and space
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 10)
    }
  }

  const attachFile = (filePath: string) => {
    if (!attachedFiles.includes(filePath)) {
      setAttachedFiles((prev) => [...prev, filePath])
    }
    setShowAttachMenu(false)
  }

  const removeAttachedFile = (filePath: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== filePath))
  }

  const filteredPinnedFiles = autocompleteQuery !== null
    ? pinnedFiles.filter((f) => f.toLowerCase().includes(autocompleteQuery.toLowerCase()))
    : []

  const unattachedPinnedFiles = pinnedFiles.filter((f) => !attachedFiles.includes(f))

  return (
    <div className="relative border-t border-border bg-card p-3 flex flex-col gap-2 shrink-0">
      {/* Autocomplete Popup */}
      {autocompleteQuery !== null && filteredPinnedFiles.length > 0 && (
        <div
          className="absolute z-50 w-64 rounded-md border border-border bg-background shadow-xl max-h-48 overflow-y-auto p-1 text-xs"
          style={{ bottom: '100%', left: '12px', marginBottom: '8px' }}
        >
          <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border/40 mb-1">
            Autocomplete File Reference
          </div>
          {filteredPinnedFiles.map((file, i) => (
            <div
              key={file}
              className={`cursor-pointer rounded px-2 py-1.5 flex items-center justify-between transition-colors ${
                i === autocompleteIndex ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary/40'
              }`}
              onClick={() => insertAutocomplete(file)}
            >
              <span className="truncate">{file.split(/[\\/]/).pop()}</span>
              <span className={`text-[9px] ${i === autocompleteIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'} font-mono ml-2 truncate max-w-[120px]`}>
                {file}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Attached Files Bar */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {attachedFiles.map((file) => (
            <div
              key={file}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/15 px-2.5 py-0.5 text-[10px] text-foreground"
            >
              <span className="truncate max-w-[150px]">{file.split(/[\\/]/).pop()}</span>
              <button
                onClick={() => removeAttachedFile(file)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Text Area Container */}
      <div className="relative flex items-end gap-2 rounded-lg border border-border bg-background/50 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 px-2 py-1.5 transition-all">
        {/* Attach File Button */}
        <div className="relative" ref={attachMenuRef}>
          <button
            onClick={() => setShowAttachMenu((v) => !v)}
            disabled={!activeSessionId}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors shrink-0"
            title="Attach context file"
          >
            <Paperclip size={16} />
          </button>

          {showAttachMenu && (
            <div className="absolute bottom-10 left-0 z-50 w-56 rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto p-1 text-xs">
              <div className="px-2 py-1.5 font-semibold text-muted-foreground border-b border-border/40">
                Attach Pinned File
              </div>
              {unattachedPinnedFiles.length === 0 ? (
                <div className="p-3 text-[10px] text-muted-foreground text-center">
                  {pinnedFiles.length === 0 ? 'No files pinned. Pin files in Explorer first.' : 'All pinned files attached.'}
                </div>
              ) : (
                unattachedPinnedFiles.map((file) => (
                  <div
                    key={file}
                    className="cursor-pointer rounded px-2 py-1.5 hover:bg-secondary/40 text-foreground truncate"
                    onClick={() => attachFile(file)}
                  >
                    {file.split(/[\\/]/).pop()}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            activeSessionId
              ? "Type prompt (use @ to insert pinned files)..."
              : "No active terminal session to send prompt"
          }
          disabled={!activeSessionId}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="flex-1 max-h-32 min-h-[32px] resize-none bg-transparent border-0 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-0 disabled:opacity-50"
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!activeSessionId || (!inputText.trim() && attachedFiles.length === 0)}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-40 transition-all shrink-0 shadow-md shadow-primary/10"
          title="Send to active terminal"
        >
          <Send size={14} />
        </button>
      </div>

      {/* Hotkey Guide */}
      {activeSessionId && (
        <div className="flex items-center justify-between text-[9px] text-muted-foreground px-1 select-none shrink-0">
          <span>Use <b>@</b> to search files</span>
          <span className="flex items-center gap-1">Press <b>Enter</b> to send <CornerDownLeft size={8} /></span>
        </div>
      )}
    </div>
  )
}
