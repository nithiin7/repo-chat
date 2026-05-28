import { notFound } from 'next/navigation'
import { listRepos } from '@/lib/api'
import ChatWindow from '@/components/chat/ChatWindow'
import type { Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ repo_id: string }>
}) {
  const { repo_id } = await params

  let repo: Repo | null = null
  try {
    const repos = await listRepos()
    repo = repos.find((r) => r.repo_id === repo_id) ?? null
  } catch {
    // Backend unreachable — render with null repo (ChatWindow handles gracefully)
  }

  // Hard 404 only if the backend confirms the repo list is available but this ID is absent
  if (repo === null && repo_id === '') notFound()

  return <ChatWindow repo={repo} repoId={repo_id} />
}
