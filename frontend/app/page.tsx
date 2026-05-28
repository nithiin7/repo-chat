import RepoList from '@/components/repo/RepoList'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import HeroSection from '@/components/hero/HeroSection'
import { listRepos } from '@/lib/api'
import type { Repo } from '@/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let repos: Repo[] = []
  try {
    repos = await listRepos()
  } catch {
    // Backend not reachable yet — render empty state
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero ── */}
      <header className="relative overflow-hidden px-4 pb-24 pt-28 text-center">
        {/* Radial glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 -top-32 h-144 w-xl -translate-x-1/2 rounded-full bg-indigo-600/8 blur-3xl" />
        </div>

        {/* Theme toggle — top-right */}
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <HeroSection />
      </header>

      {/* ── Repo list ── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <RepoList repos={repos} />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground/60">
        CodeLens — powered by LlamaIndex · ChromaDB · Ollama / Anthropic
      </footer>
    </div>
  )
}
