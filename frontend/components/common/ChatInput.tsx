'use client'

import { useEffect, useRef } from 'react'
import { SendHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LLMMode } from '@/types'

interface ChatInputProps {
  input: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  streaming: boolean
  mode: LLMMode
}

const ChatInput = ({ input, onChange, onSubmit, onStop, streaming, mode }: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="mx-auto flex max-w-3xl items-end gap-2"
      >
        <div
          className={cn(
            'flex flex-1 items-end rounded-xl border bg-card px-4 py-2.5 transition-colors duration-150',
            streaming ? 'border-border/40' : 'border-border focus-within:border-indigo-500/40',
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={streaming ? 'Responding…' : 'Ask about this codebase…'}
            rows={1}
            className="max-h-44 flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-40"
          />
        </div>

        {streaming ? (
          <Button
            type="button"
            onClick={onStop}
            size="icon-lg"
            className="h-auto w-9 self-stretch border border-border bg-card text-foreground hover:bg-muted"
            aria-label="Stop generating"
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-lg"
            disabled={!input.trim()}
            aria-label="Send message"
            className="h-auto w-9 self-stretch"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </form>

      <p className="mt-2.5 text-center text-[11px] text-muted-foreground/50">
        {mode === 'local' ? '⚡ Local — no data leaves your machine' : '☁ Cloud — data sent to LLM API'}
        &nbsp;·&nbsp;Enter to send · Shift+Enter for newline
      </p>
    </div>
  )
}

export default ChatInput
