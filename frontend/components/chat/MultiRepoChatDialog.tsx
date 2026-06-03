'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompare, X } from 'lucide-react'
import ChatInput from '@/components/common/ChatInput'
import MessageBubble from './MessageBubble'
import LLMModeToggle from './LLMModeToggle'
import ModelPicker from './ModelPicker'
import { chatStream } from '@/lib/api/chats'
import type { LLMMode, Message, Repo, SourceChunk } from '@/types'

interface MultiRepoChatDialogProps {
  repos: Repo[]
  onClose: () => void
}

const MultiRepoChatDialog = ({ repos, onClose }: MultiRepoChatDialogProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<LLMMode>('local')
  const [streaming, setStreaming] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  useEffect(() => {
    if (userScrolledUp.current) return
    const container = scrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !streaming) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [streaming, onClose])

  const submit = useCallback(
    (question: string) => {
      const q = question.trim()
      if (!q || streaming) return

      userScrolledUp.current = false
      setStreaming(true)
      setInput('')

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: q },
        { id: crypto.randomUUID(), role: 'assistant', content: '', streaming: true },
      ])

      const cancel = chatStream(
        { repo_ids: repos.map((r) => r.repo_id), question: q, mode },
        (token) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, content: last.content + token }]
          })
        },
        (sources: SourceChunk[]) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, sources }]
          })
        },
        (suggestions: string[]) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, suggestions, suggestionsLoading: false }]
          })
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false, suggestionsLoading: true }]
          })
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content || 'Something went wrong. Please try again.', streaming: false, error: true },
            ]
          })
          setStreaming(false)
          cancelRef.current = null
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false, suggestionsLoading: false }]
          })
          setStreaming(false)
          cancelRef.current = null
        },
        (usage) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, usage }]
          })
        },
      )

      cancelRef.current = cancel
    },
    [streaming, mode, repos],
  )

  const handleStop = () => {
    cancelRef.current?.()
    cancelRef.current = null
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [...prev.slice(0, -1), { ...last, streaming: false }]
    })
    setStreaming(false)
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => { if (!streaming) onClose() }}
      />

      {/* Dialog */}
      <motion.div
        key="dialog"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-8 md:inset-12 lg:inset-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <GitCompare className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Cross-repo comparison</p>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {repos.map((r) => {
                  const name = r.name || r.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/')
                  return (
                    <span key={r.repo_id} className="rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-indigo-400">
                      {name}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LLMModeToggle mode={mode} onChange={setMode} disabled={streaming} />
            <button
              onClick={() => { if (!streaming) onClose() }}
              aria-label="Close comparison chat"
              disabled={streaming}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Message area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <GitCompare className="size-10 text-muted-foreground/30" />
              <p className="font-semibold text-foreground">Ask a cross-cutting question</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Compare implementations, patterns, or design decisions across the selected repositories.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {[
                  'How does auth differ between these repos?',
                  'Compare the error handling approaches',
                  'Which repo has better test coverage patterns?',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-indigo-500/30 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 py-8">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onSuggestionClick={submit}
                />
              ))}
            </div>
          )}
          <div className="h-4" />
        </div>

        {/* Input */}
        <ChatInput
          input={input}
          onChange={setInput}
          onSubmit={() => submit(input)}
          onStop={handleStop}
          streaming={streaming}
          mode={mode}
          modelPicker={<ModelPicker mode={mode} disabled={streaming} />}
        />
      </motion.div>
    </AnimatePresence>
  )
}

export default MultiRepoChatDialog
