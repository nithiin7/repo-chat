'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, GitFork, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import LLMModeToggle from './LLMModeToggle'
import MessageBubble from './MessageBubble'
import ChatSidebar from './ChatSidebar'
import ChatEmptyState from './ChatEmptyState'
import ChatInput from '@/components/common/ChatInput'
import { chatStream, getChatMessages, listChats } from '@/lib/api/chats'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Chat, ChatMessage, LLMMode, Message, Repo } from '@/types'

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

const ChatWindow = ({ repo, repoId, chatId, chats: initialChats, initialMessages }: ChatWindowProps) => {
  const queryClient = useQueryClient()

  const [activeChatId, setActiveChatId] = useState(chatId)
  const [messages, setMessages] = useState<Message[]>(() => dbMessagesToUi(initialMessages))
  const [mode, setMode] = useState<LLMMode>('local')
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Seed chats cache from server-fetched data; ChatSidebar shares this query key
  useQuery({
    queryKey: queryKeys.chats(repoId),
    queryFn: () => listChats(repoId),
    initialData: initialChats,
  })

  const cancelRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  const displayName =
    repo?.name ||
    repo?.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/') ||
    repoId

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

  const handleSelectChat = useCallback(async (chat: Chat) => {
    if (chat.id === activeChatId) return
    setActiveChatId(chat.id)
    setMessages([])
    setInput('')
    userScrolledUp.current = false
    window.history.pushState(null, '', `/chat/${repoId}/${chat.id}`)
    try {
      const msgs = await queryClient.fetchQuery({
        queryKey: queryKeys.chatMessages(chat.id),
        queryFn: () => getChatMessages(chat.id),
        staleTime: 5 * 60 * 1000,
      })
      setMessages(dbMessagesToUi(msgs))
    } catch {
      setMessages([])
    }
  }, [activeChatId, repoId, queryClient])

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

      // Optimistically update sidebar title on the first message
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (prev = []) =>
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
        (suggestions) => {
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
            return [...prev.slice(0, -1), { ...last, streaming: false, suggestionsLoading: false }]
          })
          setStreaming(false)
          cancelRef.current = null
          // Invalidate so next visit to this chat fetches fresh persisted messages
          void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(activeChatId) })
        },
      )

      cancelRef.current = cancel
    },
    [streaming, mode, repoId, activeChatId, queryClient],
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
    <div className="flex h-screen overflow-hidden flex-col bg-background text-foreground">
      {/* ── Sticky header ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/dashboard"
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
          <Link
            href={`/search/${repoId}`}
            aria-label="Search codebase"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-4" />
          </Link>
          <LLMModeToggle mode={mode} onChange={setMode} disabled={streaming} />
          <ThemeToggle />
        </div>
      </motion.header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="shrink-0 overflow-hidden border-r border-border"
        >
          <div className="w-65 h-full">
            <ChatSidebar
              repoId={repoId}
              activeChatId={activeChatId}
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
              <ChatEmptyState repo={repo} mode={mode} onSuggestionClick={submit} />
            ) : (
              <div className="mx-auto max-w-3xl px-4 py-8">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} onSuggestionClick={submit} />
                ))}
              </div>
            )}
            <div className="h-4" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <ChatInput
              input={input}
              onChange={setInput}
              onSubmit={() => submit(input)}
              onStop={handleStop}
              streaming={streaming}
              mode={mode}
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ChatWindow
