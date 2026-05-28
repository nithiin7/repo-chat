'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitFork, SendHorizontal, Square, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LLMModeToggle from './LLMModeToggle'
import MessageBubble from './MessageBubble'
import { chatStream } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LLMMode, Message, Repo } from '@/types'

const SUGGESTIONS = [
  'What does this codebase do?',
  'What are the main entry points?',
  'How is authentication handled?',
  'Explain the folder structure',
]

interface ChatWindowProps {
  repo: Repo | null
  repoId: string
}

export default function ChatWindow({ repo, repoId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [mode, setMode] = useState<LLMMode>('local')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  const cancelRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledUp = useRef(false)

  const displayName =
    repo?.name ||
    repo?.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/') ||
    repoId

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  // Scroll to bottom after every message update, unless user scrolled up
  useEffect(() => {
    if (userScrolledUp.current) return
    const container = scrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  // Track whether user has manually scrolled up
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80
  }

  const submit = useCallback(
    (question: string) => {
      const q = question.trim()
      if (!q || streaming) return

      userScrolledUp.current = false
      setStreaming(true)
      setInput('')

      const assistantId = crypto.randomUUID()

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: q },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])

      const cancel = chatStream(
        { repo_id: repoId, question: q, mode },
        // onToken — append to the last assistant message
        (token) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, content: last.content + token }]
          })
        },
        // onSources — attach retrieved chunks to the current assistant message
        (sources) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, sources }]
          })
        },
        // onError
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: last.content || 'Something went wrong. Please try again.',
                streaming: false,
                error: true,
              },
            ]
          })
          setStreaming(false)
          cancelRef.current = null
        },
        // onDone
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, streaming: false }]
          })
          setStreaming(false)
          cancelRef.current = null
        },
      )

      cancelRef.current = cancel
    },
    [streaming, mode, repoId],
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      {/* ── Sticky header ─────────────────────────────── */}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to repositories"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="mx-1 h-5 w-px shrink-0 bg-slate-800" aria-hidden />

          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
            <GitFork className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            {repo && (
              <p className="truncate text-xs text-slate-500">
                {repo.file_count.toLocaleString()} files indexed
              </p>
            )}
          </div>
        </div>

        <LLMModeToggle mode={mode} onChange={setMode} disabled={streaming} />
      </header>

      {/* ── Message list ──────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4 pb-16 pt-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-600">
              <Code2 className="size-7" />
            </div>
            <div>
              <p className="font-semibold text-slate-300">Ask anything about this codebase</p>
              <p className="mt-1 text-sm text-slate-600">
                {repo
                  ? `${repo.file_count.toLocaleString()} files indexed · ${mode === 'local' ? 'local LLM' : 'cloud LLM'}`
                  : 'Repository is indexed and ready'}
              </p>
            </div>
            <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-400 transition-all hover:border-indigo-500/40 hover:bg-slate-800/60 hover:text-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-8">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* ── Input bar ─────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/90 px-4 py-4 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          <div
            className={cn(
              'flex flex-1 items-end rounded-xl border bg-slate-900/70 px-4 py-2.5 transition-colors duration-150',
              streaming
                ? 'border-slate-700/40'
                : 'border-slate-700/60 focus-within:border-indigo-500/50',
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder={streaming ? 'Responding…' : 'Ask about this codebase…'}
              rows={1}
              className="max-h-44 flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 outline-none disabled:opacity-40"
            />
          </div>

          {streaming ? (
            <Button
              type="button"
              onClick={handleStop}
              size="icon-lg"
              className="shrink-0 border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
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
              className="shrink-0"
            >
              <SendHorizontal className="size-4" />
            </Button>
          )}
        </form>

        <p className="mt-2.5 text-center text-[11px] text-slate-700">
          {mode === 'local'
            ? '⚡ Local — no data leaves your machine'
            : '☁ Cloud — data sent to LLM API'}
          &nbsp;·&nbsp;Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
