import RepoList from '@/components/repo/RepoList'
import { NavBar } from '@/components/ui/nav-bar'
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
    <div className="relative flex min-h-screen flex-col">

      {/* ── Full-page ambient glow — fixed so it covers the entire viewport on scroll ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-175 w-225 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-96 w-96 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      <NavBar transparent />

      {/* ── Hero ── */}
      <header className="relative px-4 pb-28 pt-16 text-center">
        <HeroSection />
      </header>

      {/* ── Repo list ── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-10 py-12">
        <RepoList repos={repos} />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/60">
        CodeLens — powered by LlamaIndex · ChromaDB · Ollama / Anthropic
      </footer>
    </div>
  )
}
