'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitFork, Search, FileCode, Copy, Check, MessageSquare } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { searchCode } from '@/lib/api/search'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Repo, SearchResult } from '@/types'

const TOP_K = 10

function scoreLabel(score: number) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 85
      ? 'bg-emerald-500/15 text-emerald-400'
      : pct >= 70
        ? 'bg-amber-500/15 text-amber-400'
        : pct >= 50
          ? 'bg-orange-500/15 text-orange-400'
          : 'bg-red-500/15 text-red-400'
  return { pct, color }
}

function ResultCard({
  result,
  index,
  repoId,
}: {
  result: SearchResult
  index: number
  repoId: string
}) {
  const [copied, setCopied] = useState(false)
  const segments = result.file_path.split('/')
  const filename = segments.pop() ?? result.file_path
  const dir = segments.length > 0 ? segments.join('/') + '/' : ''
  const { pct, color } = scoreLabel(result.score)

  const copy = () => {
    navigator.clipboard.writeText(result.chunk).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="group overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* File path row */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-mono text-xs">
            {dir && <span className="text-muted-foreground">{dir}</span>}
            <span className="font-medium text-foreground">{filename}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums', color)}>
            {pct}%
          </span>
          <Link
            href={`/chat/${repoId}?q=${encodeURIComponent(`Tell me about ${result.file_path}`)}`}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            <MessageSquare className="size-3" />
            Ask in chat
          </Link>
        </div>
      </div>

      {/* Code chunk */}
      <div className="relative">
        <pre className="max-h-72 overflow-auto p-4 text-xs leading-relaxed text-foreground/80">
          <code className="font-mono">{result.chunk}</code>
        </pre>
        <button
          onClick={copy}
          aria-label="Copy code"
          className={cn(
            'absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150',
            copied
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'border border-border bg-card text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground',
          )}
        >
          {copied ? <><Check className="size-3" />Copied</> : <><Copy className="size-3" />Copy</>}
        </button>
      </div>
    </motion.div>
  )
}

interface SearchViewProps {
  repo: Repo | null
  repoId: string
}

const SearchView = ({ repo, repoId }: SearchViewProps) => {
  const [input, setInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.search(repoId, submittedQuery, TOP_K),
    queryFn: () => searchCode(repoId, submittedQuery, TOP_K),
    enabled: submittedQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const submit = () => {
    const q = input.trim()
    if (!q) return
    setSubmittedQuery(q)
  }

  const displayName =
    repo?.name ||
    repo?.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/') ||
    repoId

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href={`/chat/${repoId}`}
            aria-label="Back to chat"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <GitFork className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            {repo && (
              <p className="truncate text-xs text-muted-foreground">
                {repo.file_count.toLocaleString()} files indexed
              </p>
            )}
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      {/* Search bar */}
      <div className="shrink-0 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-md">
        <form
          onSubmit={(e) => { e.preventDefault(); submit() }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 focus-within:border-indigo-500/40 transition-colors duration-150">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="Search by intent — e.g. authentication middleware, rate limiting…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <Button type="submit" disabled={!input.trim() || isFetching} className="shrink-0">
            {isFetching ? 'Searching…' : 'Search'}
          </Button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            {/* Loading skeleton */}
            {isFetching && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
                      <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                      <div className="ml-auto h-4 w-10 animate-pulse rounded-full bg-muted" />
                    </div>
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div
                          key={j}
                          className="h-3 animate-pulse rounded bg-muted"
                          style={{ width: `${70 + (j % 3) * 10}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Error */}
            {isError && !isFetching && (
              <motion.p
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-sm text-destructive"
              >
                Search failed. Make sure the backend is running.
              </motion.p>
            )}

            {/* Results */}
            {data && !isFetching && (
              <motion.div
                key={`results-${submittedQuery}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {data.results.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No results for <span className="font-medium text-foreground">&ldquo;{submittedQuery}&rdquo;</span>
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-xs text-muted-foreground">
                      {data.results.length} result{data.results.length !== 1 ? 's' : ''} for{' '}
                      <span className="font-medium text-foreground">&ldquo;{submittedQuery}&rdquo;</span>
                    </p>
                    <div className="flex flex-col gap-4">
                      {data.results.map((result, i) => (
                        <ResultCard key={i} result={result} index={i} repoId={repoId} />
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Empty prompt */}
            {!submittedQuery && !isFetching && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 pt-16 text-center"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Search className="size-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Semantic code search</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Describe what you&apos;re looking for in plain English. Results are ranked by embedding similarity — no keywords needed.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default SearchView
