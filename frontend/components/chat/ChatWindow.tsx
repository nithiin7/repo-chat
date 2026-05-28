'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, GitFork, PanelLeftClose, PanelLeftOpen, SendHorizontal, Square, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import LLMModeToggle from './LLMModeToggle'
import MessageBubble from './MessageBubble'
import ChatSidebar from './ChatSidebar'
import { chatStream, getChatMessages } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Chat, ChatMessage, LLMMode, Message, Repo } from '@/types'

const SUGGESTIONS = [
  'What does this codebase do?',
  'What are the main entry points?',
  'How is authentication handled?',
  'Explain the folder structure',
]

function dbMessagesToUi(dbMessages: ChatMessage[]): Message[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    sources: m.sources ?? undefined,
  }))
}

interface ChatWindowProps {
  repo: Repo | null
  repoId: string
  chatId: string
  chats: Chat[]
  initialMessages: ChatMessage[]
}

export default function ChatWindow({ repo, repoId, chatId, chats: initialChats, initialMessages }: ChatWindowProps) {
  const [activeChatId, setActiveChatId] = useState(chatId)
  const [messages, setMessages] = useState<Message[]>(() => dbMessagesToUi(initialMessages))
  const [mode, setMode] = useState<LLMMode>('local')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chats, setChats] = useState<Chat[]>(initialChats)

  const cancelRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledUp = useRef(false)

  const displayName =
    repo?.name ||
    repo?.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/') ||
    repoId

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

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

  // Switch to a different chat without a full page reload
  const handleSelectChat = useCallback(async (chat: Chat) => {
    if (chat.id === activeChatId) return
    setActiveChatId(chat.id)
    setMessages([])
    setInput('')
    userScrolledUp.current = false
    // Update the URL so the page is bookmarkable, without triggering a server navigation
    window.history.pushState(null, '', `/chat/${repoId}/${chat.id}`)
    try {
      const msgs = await getChatMessages(chat.id)
      setMessages(dbMessagesToUi(msgs))
    } catch {
      setMessages([])
    }
  }, [activeChatId, repoId])

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

      // Optimistically update the sidebar title on the first message
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChatId && c.title === 'New Chat'
            ? { ...c, title: q.slice(0, 60).trimEnd() }
            : c,
        ),
      )

      const cancel = chatStream(
        { repo_id: repoId, question: q, mode, chat_id: activeChatId },
        (token) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, content: last.content + token }]
          })
        },
        (sources) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [...prev.slice(0, -1), { ...last, sources }]
          })
        },
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
    [streaming, mode, repoId, activeChatId],
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
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* ── Sticky header ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to repositories"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

          <button
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>

          <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <GitFork className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            {repo && (
              <p className="truncate text-xs text-muted-foreground">
                {repo.file_count.toLocaleString()} files indexed
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <LLMModeToggle mode={mode} onChange={setMode} disabled={streaming} />
          <ThemeToggle />
        </div>
      </motion.header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 220 : 0, opacity: sidebarOpen ? 1 : 0 }} // framer-motion needs px values
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="shrink-0 overflow-hidden border-r border-border"
        >
          <div className="w-55 h-full">
            <ChatSidebar
              repoId={repoId}
              activeChatId={activeChatId}
              chats={chats}
              onChatsChange={setChats}
              onSelectChat={handleSelectChat}
            />
          </div>
        </motion.aside>

        {/* Main chat column */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Message list */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-4 pb-16 pt-8 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-indigo-400"
                >
                  <Sparkles className="size-6" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <p className="font-semibold text-foreground">Ask anything about this codebase</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {repo
                      ? `${repo.file_count.toLocaleString()} files indexed · ${mode === 'local' ? 'local LLM' : 'cloud LLM'}`
                      : 'Repository is indexed and ready'}
                  </p>
                </motion.div>
                <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.18 + i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                      whileHover={{ y: -2 }}
                      onClick={() => submit(s)}
                      className="cursor-pointer rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm text-muted-foreground transition-[border-color,background-color,color] duration-150 hover:border-indigo-500/30 hover:bg-card hover:text-foreground"
                    >
                      {s}
                    </motion.button>
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
            <div className="h-4" />
          </div>

          {/* ── Input bar ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="shrink-0 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit(input)
              }}
              className="mx-auto flex max-w-3xl items-end gap-2"
            >
              <div
                className={cn(
                  'flex flex-1 items-end rounded-xl border bg-card px-4 py-2.5 transition-colors duration-150',
                  streaming
                    ? 'border-border/40'
                    : 'border-border focus-within:border-indigo-500/40',
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
                  className="max-h-44 flex-1 resize-none bg-transparent py-0.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-40"
                />
              </div>

              {streaming ? (
                <Button
                  type="button"
                  onClick={handleStop}
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
              {mode === 'local'
                ? '⚡ Local — no data leaves your machine'
                : '☁ Cloud — data sent to LLM API'}
              &nbsp;·&nbsp;Enter to send · Shift+Enter for newline
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
