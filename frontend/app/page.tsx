'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  CodeXml,
  MessageSquare,
  Cpu,
  Cloud,
  GitBranch,
  GitCompare,
  GitFork,
  GitPullRequest,
  Zap,
  Database,
  Search,
  ListTree,
  Share2,
  ArrowRight,
  FileCode,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const ease = 'easeOut' as const

const FEATURES = [
  {
    icon: <MessageSquare className="size-5 text-indigo-400" />,
    title: 'Natural language Q&A',
    description:
      'Ask questions about any codebase in plain English. CodeLens finds the relevant code and answers with full context.',
  },
  {
    icon: <GitFork className="size-5 text-violet-400" />,
    title: 'GitHub & Bitbucket support',
    description:
      'Paste any public or private repo URL. For private GitHub repos, expand the token field and paste your PAT — no env setup needed.',
  },
  {
    icon: <GitBranch className="size-5 text-indigo-400" />,
    title: 'Branch selection',
    description:
      'Pin indexing to any branch — develop, a feature branch, a release tag. Leave it blank to use the default. The active branch is shown on the repo card and tracked for update checks.',
  },
  {
    icon: <Cpu className="size-5 text-emerald-400" />,
    title: 'Fully local mode',
    description:
      'Run with Ollama and nothing ever leaves your machine — no API keys, no data sent to external servers.',
  },
  {
    icon: <Cloud className="size-5 text-sky-400" />,
    title: 'Cloud LLM support',
    description:
      'Switch to Anthropic, OpenAI, Groq, or Gemini for more powerful answers. Toggle per chat session from the UI.',
  },
  {
    icon: <Database className="size-5 text-orange-400" />,
    title: 'Persistent vector store',
    description:
      'Repos are indexed once into ChromaDB. Subsequent chats reuse the index instantly — no re-indexing needed.',
  },
  {
    icon: <Zap className="size-5 text-yellow-400" />,
    title: 'Streaming responses',
    description:
      'Answers stream token-by-token via SSE so you see results immediately, even for long explanations.',
  },
  {
    icon: <Search className="size-5 text-pink-400" />,
    title: 'Semantic code search',
    description:
      'Search by intent, not keywords. Describe what you\'re looking for and get ranked code chunks by embedding similarity — no LLM needed.',
  },
  {
    icon: <ListTree className="size-5 text-violet-400" />,
    title: 'Symbol navigator',
    description:
      'Browse every function, class, and method in the repo — extracted via AST parsing, not retrieval. Filter by kind, expand definitions inline, and jump straight to chat.',
  },
  {
    icon: <Share2 className="size-5 text-orange-400" />,
    title: 'Dependency map',
    description:
      'Visualize module-level import relationships as an interactive force-directed graph. Click any file to see what it imports and what imports it.',
  },
  {
    icon: <Activity className="size-5 text-emerald-400" />,
    title: 'Repo health summary',
    description:
      'Auto-generated overview of complexity hotspots, TODO/FIXME comments, and a test coverage estimate — surfaced as a panel inside the chat view.',
  },
  {
    icon: <FileCode className="size-5 text-indigo-400" />,
    title: 'Code block actions',
    description:
      'Hover any code block in a response to copy it instantly. Source file references link directly to the file in GitHub, Bitbucket, or GitLab.',
  },
  {
    icon: <GitPullRequest className="size-5 text-rose-400" />,
    title: 'PR & diff analysis',
    description:
      'Paste a GitHub or Bitbucket PR URL, a commit URL, or a raw SHA to load the diff as chat context. Ask "what does this PR change?" or "are there any risks?" — the LLM answers against both the diff and the full codebase index.',
  },
  {
    icon: <GitCompare className="size-5 text-indigo-400" />,
    title: 'Cross-repo comparison',
    description:
      'Select two or more indexed repos from the dashboard and open a shared chat. Ask comparative questions like "How does auth differ between these repos?" — the LLM retrieves context from all selected repos and answers with repo-labeled evidence.',
  },
]

const LandingPage = () => {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-175 w-225 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-96 w-96 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      {/* nav */}
      <nav className="sticky top-0 z-40 border-b border-transparent bg-transparent">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
              <CodeXml className="size-4 text-indigo-500" />
            </div>
            <span>CodeLens</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* hero */}
      <header className="relative px-4 pb-24 pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3.5 py-1.5 text-xs font-medium tracking-wide text-muted-foreground"
        >
          <Zap className="size-3 text-indigo-500" />
          RAG-powered · Local or Cloud LLM
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.08, ease }}
          className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/5"
        >
          <CodeXml className="size-7 text-indigo-500" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease }}
          className="bg-linear-to-b from-foreground to-foreground/40 bg-clip-text text-5xl font-bold tracking-tight text-transparent dark:from-white dark:via-white/90 dark:to-white/40 sm:text-6xl"
        >
          CodeLens
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease }}
          className="mt-4 text-lg text-muted-foreground"
        >
          Ask anything about any codebase — powered by RAG
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32, ease }}
          className="mt-10"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-600 hover:shadow-indigo-500/30"
          >
            Go to Dashboard
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </header>

      {/* features */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 sm:px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/60"
        >
          Features
        </motion.p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 + i * 0.07, ease }}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg border border-border bg-muted">
                {f.icon}
              </div>
              <h3 className="mb-1.5 text-sm font-semibold">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </main>

      {/* footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground/60">
        CodeLens — powered by LlamaIndex · ChromaDB · Ollama / Anthropic
      </footer>
    </div>
  )
}

export default LandingPage
