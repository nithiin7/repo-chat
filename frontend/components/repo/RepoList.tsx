import { BookOpen } from 'lucide-react'
import RepoCard from './RepoCard'
import type { Repo } from '@/types'

export default function RepoList({ repos }: { repos: Repo[] }) {
  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
          <BookOpen className="size-7 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">No repositories indexed yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Paste a GitHub or Bitbucket URL above to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <section>
      <div className="mb-5 flex items-center gap-2.5">
        <h2 className="font-semibold text-slate-900">Your Repositories</h2>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          {repos.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <RepoCard key={repo.repo_id} repo={repo} />
        ))}
      </div>
    </section>
  )
}
