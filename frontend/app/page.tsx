"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CodeXml,
  ArrowRight,
  Zap,
  Search,
  Share2,
  GitPullRequest,
  Cpu,
  Cloud,
  ListTree,
  User,
  Sparkles,
  FileCode2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const ease = "easeOut" as const;

const STEPS = [
  {
    n: "01",
    title: "Paste a repo URL",
    body: "GitHub or Bitbucket — public or private. Optionally pin a branch.",
  },
  {
    n: "02",
    title: "Index once",
    body: "CodeLens chunks your code, builds a vector index, and extracts symbols. Takes seconds to minutes.",
  },
  {
    n: "03",
    title: "Ask anything",
    body: "Open a chat and ask in plain English. Answers stream back with cited source files.",
  },
];

const FEATURES = [
  {
    icon: <Cpu className="size-4 text-emerald-400" />,
    title: "Fully local",
    body: "Ollama backend — no API key, no data leaves your machine.",
  },
  {
    icon: <Cloud className="size-4 text-sky-400" />,
    title: "Cloud LLMs",
    body: "Switch to Anthropic, OpenAI, Groq, or Gemini per chat session.",
  },
  {
    icon: <Search className="size-4 text-pink-400" />,
    title: "Semantic search",
    body: "Search by intent, not keywords. Ranked by embedding similarity.",
  },
  {
    icon: <ListTree className="size-4 text-violet-400" />,
    title: "Symbol navigator",
    body: "Browse every function and class via AST — not retrieval.",
  },
  {
    icon: <Share2 className="size-4 text-orange-400" />,
    title: "Dependency map",
    body: "Interactive force-directed import graph. Click any file to explore.",
  },
  {
    icon: <GitPullRequest className="size-4 text-rose-400" />,
    title: "PR & diff analysis",
    body: "Paste a PR URL. Ask what it changes, what risks it carries.",
  },
];

const MOCK_MESSAGES = [
  {
    role: "user" as const,
    text: "What does the auth middleware do and where is it used?",
  },
  {
    role: "assistant" as const,
    text: "The auth middleware in `middleware/auth.py` validates JWT tokens on every incoming request. It extracts the Bearer token from the `Authorization` header, verifies the signature against `SECRET_KEY`, and attaches the decoded `user_id` to `request.state`.\n\nIt's registered globally in `main.py:42` and skipped for the `/health` and `/auth/login` routes via the `EXEMPT_PATHS` list.",
    sources: ["middleware/auth.py", "main.py", "core/security.py"],
  },
];

function MockChat() {
  return (
    <div className="border-border bg-card w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl shadow-black/10">
      {/* titlebar */}
      <div className="border-border bg-muted/50 flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-red-400/70" />
          <span className="size-3 rounded-full bg-yellow-400/70" />
          <span className="size-3 rounded-full bg-green-400/70" />
        </div>
        <div className="text-muted-foreground mx-auto flex items-center gap-1.5 text-xs font-medium">
          <FileCode2 className="size-3.5 text-indigo-400" />
          codelens · my-project
        </div>
      </div>

      {/* messages */}
      <div className="flex flex-col gap-5 p-5">
        {MOCK_MESSAGES.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 + i * 0.35, ease }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                msg.role === "user"
                  ? "border-indigo-500/30 bg-indigo-500/10"
                  : "border-border bg-muted"
              }`}
            >
              {msg.role === "user" ? (
                <User className="size-3.5 text-indigo-400" />
              ) : (
                <Sparkles className="size-3.5 text-violet-400" />
              )}
            </div>

            <div
              className={`flex max-w-[85%] flex-col gap-2 ${msg.role === "user" ? "items-end" : ""}`}
            >
              <div
                className={`rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user" ? "bg-indigo-500 text-white" : "bg-muted text-foreground"
                }`}
              >
                {msg.text.split("`").map((part, j) =>
                  j % 2 === 1 ? (
                    <code key={j} className="rounded bg-black/20 px-1 py-0.5 font-mono text-[11px]">
                      {part}
                    </code>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>

              {"sources" in msg && msg.sources && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.sources.map((s) => (
                    <span
                      key={s}
                      className="border-border bg-muted text-muted-foreground rounded border px-2 py-0.5 font-mono text-[10px]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* fake input */}
      <div className="border-border bg-muted/30 border-t px-4 py-3">
        <div className="border-border bg-background flex items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-muted-foreground/40 flex-1 text-xs">Ask a follow-up…</span>
          <div className="flex size-5 items-center justify-center rounded bg-indigo-500/20">
            <ArrowRight className="size-3 text-indigo-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 h-150 w-225 -translate-x-1/2 rounded-full bg-indigo-600/8 blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-5%] h-80 w-80 rounded-full bg-violet-600/6 blur-3xl" />
      </div>

      {/* nav */}
      <nav className="sticky top-0 z-40 border-b border-transparent bg-transparent">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
              <CodeXml className="size-4 text-indigo-500" />
            </div>
            CodeLens
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              Dashboard
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* hero */}
      <header className="relative flex flex-col items-center px-4 pt-20 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="border-border bg-muted text-muted-foreground mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide"
        >
          <Zap className="size-3 text-indigo-500" />
          Local-first · RAG-powered
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease }}
          className="from-foreground to-foreground/40 mx-auto max-w-2xl bg-linear-to-b bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl dark:from-white dark:via-white/90 dark:to-white/40"
        >
          Ask anything about any codebase
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease }}
          className="text-muted-foreground mx-auto mt-5 max-w-lg text-lg leading-relaxed"
        >
          Paste a GitHub URL. CodeLens indexes your repo and answers questions in plain English —
          runs fully local or with cloud LLMs.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease }}
          className="mt-9 flex items-center gap-3"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-600 hover:shadow-indigo-500/30"
          >
            Start exploring
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground border-border rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
          >
            View dashboard
          </Link>
        </motion.div>

        {/* mock chat */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.42, ease }}
          className="mt-14 w-full max-w-2xl px-2"
        >
          <MockChat />
        </motion.div>
      </header>

      {/* how it works */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-muted-foreground/60 mb-10 text-center text-xs font-semibold tracking-widest uppercase"
        >
          How it works
        </motion.p>

        <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1, ease }}
              className="relative flex flex-col gap-3 px-8 py-8"
            >
              {/* connector line between steps */}
              {i < STEPS.length - 1 && (
                <div className="border-border/60 absolute top-1/2 right-0 hidden h-px w-full -translate-y-1/2 border-t border-dashed sm:block" />
              )}
              <span className="font-mono text-3xl font-bold text-indigo-500/20">{s.n}</span>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-10">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-muted-foreground/60 mb-10 text-center text-xs font-semibold tracking-widest uppercase"
        >
          Capabilities
        </motion.p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.07, ease }}
              className="border-border bg-card flex items-start gap-3.5 rounded-xl border p-4"
            >
              <div className="border-border bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* cta strip */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease }}
          className="border-border bg-card flex flex-col items-center gap-5 rounded-2xl border px-8 py-12 text-center"
        >
          <div className="flex size-11 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
            <CodeXml className="size-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Ready to explore your codebase?</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              No signup. No cloud required. Just paste a repo URL and start asking.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-600"
          >
            Open dashboard
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>

      {/* footer */}
      <footer className="border-border/40 text-muted-foreground/50 border-t py-6 text-center text-xs">
        CodeLens — powered by LlamaIndex · ChromaDB · Ollama / Anthropic
      </footer>
    </div>
  );
}
