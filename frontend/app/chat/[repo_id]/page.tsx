import { redirect } from 'next/navigation'
import { createChat, listChats } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function ChatIndexPage({
  params,
}: {
  params: Promise<{ repo_id: string }>
}) {
  const { repo_id } = await params

  let targetChatId: string | null = null

  try {
    const chats = await listChats(repo_id)
    if (chats.length > 0) {
      targetChatId = chats[0].id
    } else {
      const chat = await createChat(repo_id)
      targetChatId = chat.id
    }
  } catch {
    // Backend unreachable
  }

  redirect(targetChatId ? `/chat/${repo_id}/${targetChatId}` : '/dashboard')
}
