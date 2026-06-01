import { listRepos } from '@/lib/api/repos'
import NavigateView from '@/components/search/NavigateView'
import type { Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function NavigatePage({
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
    // Backend unreachable — NavigateView handles gracefully
  }

  return <NavigateView repo={repo} repoId={repo_id} />
}
