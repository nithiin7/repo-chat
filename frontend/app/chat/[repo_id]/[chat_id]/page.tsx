import { notFound } from 'next/navigation'
import { getChatMessages, listChats } from '@/lib/api/chats'
import { listRepos } from '@/lib/api/repos'
import ChatWindow from '@/components/chat/ChatWindow'
import type { Chat, ChatMessage, Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ repo_id: string; chat_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { repo_id, chat_id } = await params
  const sp = await searchParams
  const initialQ = typeof sp.q === 'string' ? sp.q : undefined

  let repo: Repo | null = null
  let chats: Chat[] = []
  let initialMessages: ChatMessage[] = []

  try {
    const [repos, chatList, messages] = await Promise.all([
      listRepos(),
      listChats(repo_id),
      getChatMessages(chat_id),
    ])
    repo = repos.find((r) => r.repo_id === repo_id) ?? null
    chats = chatList
    initialMessages = messages
  } catch {
    // Backend unreachable — ChatWindow handles gracefully
  }

  if (repo === null && repo_id === '') notFound()

  return (
    <ChatWindow
      repo={repo}
      repoId={repo_id}
      chatId={chat_id}
      chats={chats}
      initialMessages={initialMessages}
      initialQ={initialQ}
    />
  )
}
