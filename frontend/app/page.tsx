import { CodeXml, Zap } from 'lucide-react'
import RepoList from '@/components/repo/RepoList'
import RepoInput from '@/components/repo/RepoInput'
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-slate-900 px-4 pb-16 pt-20 text-center">
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="relative mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium tracking-wide text-indigo-400">
          <Zap className="size-3" />
          RAG-powered · Local or Cloud LLM
        </div>

        {/* Logo */}
        <div className="relative mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 shadow-xl shadow-indigo-500/30">
          <CodeXml className="size-7 text-white" />
        </div>

        {/* Title */}
        <h1 className="relative text-5xl font-bold tracking-tight text-white sm:text-6xl">
          CodeLens
        </h1>
        <p className="relative mt-3 text-lg text-slate-400">
          Ask anything about any codebase
        </p>

        {/* Index input */}
        <div className="relative mx-auto mt-10 max-w-2xl">
          <RepoInput />
        </div>

        {/* Fade into content */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-slate-50"
        />
      </header>

      {/* ── Repo list ─────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <RepoList repos={repos} />
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        CodeLens — powered by LlamaIndex · ChromaDB · Ollama / Anthropic
      </footer>
    </div>
  )
}
