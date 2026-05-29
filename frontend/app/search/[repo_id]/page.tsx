import { listRepos } from '@/lib/api/repos'
import SearchView from '@/components/search/SearchView'
import type { Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function SearchPage({
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
    // Backend unreachable — SearchView handles gracefully
  }

  return <SearchView repo={repo} repoId={repo_id} />
}
