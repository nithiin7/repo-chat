'use client'

import { useState } from 'react'
import { MessageSquarePlus, Trash2, Check, X, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { createChat, deleteChatSession, listChats, renameChat } from '@/lib/api/chats'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Chat } from '@/types'

interface ChatSidebarProps {
  repoId: string
  activeChatId: string
  onSelectChat: (chat: Chat) => void
}

const ChatSidebar = ({ repoId, activeChatId, onSelectChat }: ChatSidebarProps) => {
  const queryClient = useQueryClient()
  const { data: chats = [] } = useQuery({
    queryKey: queryKeys.chats(repoId),
    queryFn: () => listChats(repoId),
  })

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleNewChat = async () => {
    const emptyChat = chats.find((c) => c.title === 'New Chat')
    if (emptyChat) {
      onSelectChat(emptyChat)
      return
    }
    setCreating(true)
    try {
      const chat = await createChat(repoId)
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (old = []) => [chat, ...old])
      onSelectChat(chat)
    } catch {
      // Silently ignore — backend may be unreachable
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await deleteChatSession(id)
      const updated = chats.filter((c) => c.id !== id)
      if (id === activeChatId) {
        if (updated.length > 0) {
          queryClient.setQueryData(queryKeys.chats(repoId), updated)
          onSelectChat(updated[0])
        } else {
          const fresh = await createChat(repoId)
          queryClient.setQueryData(queryKeys.chats(repoId), [fresh])
          onSelectChat(fresh)
        }
      } else {
        queryClient.setQueryData(queryKeys.chats(repoId), updated)
      }
    } catch {
      // Silently ignore
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditValue(chat.title)
  }

  const commitEdit = async (id: string) => {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }
    try {
      const updated = await renameChat(id, trimmed)
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (old = []) =>
        old.map((c) => (c.id === id ? updated : c)),
      )
    } catch {
      // Silently ignore
    } finally {
      setEditingId(null)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitEdit(id)
    } else if (e.key === 'Escape') {
      setEditingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chats</span>
        <button
          onClick={() => void handleNewChat()}
          disabled={creating}
          title="New chat"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <AnimatePresence initial={false}>
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId
            const isEditing = editingId === chat.id
            const isDeleting = deletingId === chat.id

            return (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  onClick={() => {
                    if (!isEditing && !isActive) onSelectChat(chat)
                  }}
                  className={cn(
                    'group relative mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-indigo-500/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, chat.id)}
                        className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none"
                      />
                      <button
                        onClick={() => void commitEdit(chat.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{chat.title}</span>
                      <div
                        className={cn(
                          'flex shrink-0 items-center gap-0.5 transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                        )}
                      >
                        <button
                          onClick={(e) => startEdit(e, chat)}
                          title="Rename"
                          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={(e) => void handleDelete(e, chat.id)}
                          title="Delete"
                          disabled={isDeleting}
                          className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {chats.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No chats yet</p>
        )}
      </div>
    </div>
  )
}

export default ChatSidebar
