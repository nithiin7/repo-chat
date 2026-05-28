import { CodeXml, Zap } from 'lucide-react'
import RepoList from '@/components/repo/RepoList'
import RepoInput from '@/components/repo/RepoInput'
import { ThemeToggle } from '@/components/ui/theme-toggle'
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

        {/* Badge */}
        <div className="relative mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
          <Zap className="size-3 text-indigo-500" />
          RAG-powered · Local or Cloud LLM
        </div>

        {/* Logo */}
        <div className="relative mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/5">
          <CodeXml className="size-7 text-indigo-500" />
        </div>

        {/* Title — gradient adapts to mode */}
        <h1 className="relative bg-linear-to-b from-foreground to-foreground/40 bg-clip-text text-5xl font-bold tracking-tight text-transparent dark:from-white dark:via-white/90 dark:to-white/40 sm:text-6xl">
          CodeLens
        </h1>
        <p className="relative mt-3 text-base text-muted-foreground">
          Ask anything about any codebase
        </p>

        {/* Index input */}
        <div className="relative mx-auto mt-10 max-w-2xl">
          <RepoInput />
        </div>
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
