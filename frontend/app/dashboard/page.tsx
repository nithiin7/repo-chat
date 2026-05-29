import RepoList from '@/components/repo/RepoList'
import RepoInput from '@/components/repo/RepoInput'
import { NavBar } from '@/components/ui/nav-bar'
import { Footer } from '@/components/ui/footer'
import { listRepos } from '@/lib/api'
import type { Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let repos: Repo[] = []
  try {
    repos = await listRepos()
  } catch {
    // Backend not reachable yet — render empty state
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-175 w-225 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-96 w-96 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      <NavBar transparent />

      {/* Centered action header */}
      <header className="px-4 pb-16 pt-14 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Dashboard
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What codebase do you want to explore?
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Paste a GitHub or Bitbucket URL — CodeLens indexes it and opens a chat.
          </p>
          <div className="mt-8">
            <RepoInput />
          </div>
        </div>
      </header>

      {/* Repo list */}
      <main className="mx-auto w-full max-w-6xl flex-1 border-t border-border/40 px-4 py-10 sm:px-6 lg:px-10">
        <RepoList repos={repos} />
      </main>

      <Footer />
    </div>
  )
}
