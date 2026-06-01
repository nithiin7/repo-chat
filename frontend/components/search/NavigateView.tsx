'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  GitFork,
  ListTree,
  FileCode,
  Copy,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { navigateSymbols } from '@/lib/api/navigate'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Repo, SymbolItem } from '@/types'

type KindFilter = 'all' | 'function' | 'class' | 'method'

const KIND_LABELS: Record<Exclude<KindFilter, 'all'>, { label: string; abbr: string; color: string }> = {
  function: { label: 'Function', abbr: 'fn',  color: 'bg-blue-500/15 text-blue-400' },
  class:    { label: 'Class',    abbr: 'cls', color: 'bg-violet-500/15 text-violet-400' },
  method:   { label: 'Method',   abbr: 'mth', color: 'bg-emerald-500/15 text-emerald-400' },
}

function KindBadge({ kind }: { kind: SymbolItem['kind'] }) {
  const cfg = KIND_LABELS[kind]
  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold', cfg.color)}>
      {cfg.abbr}
    </span>
  )
}

function SymbolRow({
  symbol,
  index,
  repoId,
}: {
  symbol: SymbolItem
  index: number
  repoId: string
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied]     = useState(false)

  const handleAsk = (e: React.MouseEvent) => {
    e.stopPropagation()
    sessionStorage.setItem(
      'codelens_nav_context',
      JSON.stringify({
        name:       symbol.name,
        kind:       symbol.kind,
        file_path:  symbol.file_path,
        start_line: symbol.start_line,
        signature:  symbol.signature,
        snippet:    symbol.snippet,
      }),
    )
    router.push(
      `/chat/${repoId}?q=${encodeURIComponent(`Explain the ${symbol.kind} ${symbol.name}`)}`,
    )
  }

  const segments = symbol.file_path.split('/')
  const filename = segments.pop() ?? symbol.file_path
  const dir      = segments.length > 0 ? segments.join('/') + '/' : ''

  const copy = () => {
    navigator.clipboard.writeText(symbol.snippet).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.03 }}
      className="group overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Index */}
        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {index + 1}
        </span>

        {/* Kind badge */}
        <KindBadge kind={symbol.kind} />

        {/* Symbol name */}
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-foreground">
          {symbol.name}
        </span>

        {/* File + line */}
        <span className="hidden min-w-0 max-w-[40%] truncate text-right font-mono text-xs text-muted-foreground sm:block">
          {dir && <span>{dir}</span>}
          <span className="font-medium text-foreground/70">{filename}</span>
          <span className="ml-1 text-muted-foreground/60">:{symbol.start_line}</span>
        </span>

        {/* Ask in chat — shown on hover */}
        <button
          onClick={handleAsk}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        >
          <MessageSquare className="size-3" />
          Ask
        </button>

        {/* Expand chevron */}
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </div>

      {/* Expandable snippet */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="snippet"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="relative">
              <pre className="max-h-64 overflow-auto p-4 text-xs leading-relaxed text-foreground/80">
                <code className="font-mono">{symbol.snippet}</code>
              </pre>
              <button
                onClick={copy}
                aria-label="Copy snippet"
                className={cn(
                  'absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150',
                  copied
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {copied ? <><Check className="size-3" />Copied</> : <><Copy className="size-3" />Copy</>}
              </button>
              {/* Mobile file path shown inside snippet */}
              <div className="flex items-center gap-1.5 border-t border-border bg-muted/30 px-4 py-2 sm:hidden">
                <FileCode className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {symbol.file_path}:{symbol.start_line}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface NavigateViewProps {
  repo: Repo | null
  repoId: string
}

const NavigateView = ({ repo, repoId }: NavigateViewProps) => {
  const [input,     setInput]     = useState('')
  const [submitted, setSubmitted] = useState('')
  const [kind,      setKind]      = useState<KindFilter>('all')

  const apiKind = kind === 'all' ? undefined : kind

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.navigate(repoId, submitted, apiKind),
    queryFn:  () => navigateSymbols(repoId, submitted, apiKind),
    staleTime: 5 * 60 * 1000,
  })

  const submit = () => setSubmitted(input.trim())

  const displayName =
    repo?.name ||
    repo?.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/') ||
    repoId

  const results = data?.results ?? []

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
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
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

      {/* Search bar + kind filter */}
      <div className="shrink-0 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); submit() }}
            className="flex items-center gap-2"
          >
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 focus-within:border-violet-500/40 transition-colors duration-150">
              <ListTree className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                placeholder="Filter by name — e.g. auth, User, handleRequest, routes/"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <Button type="submit" disabled={isFetching} className="shrink-0">
              {isFetching ? 'Loading…' : 'Go'}
            </Button>
          </form>

          {/* Kind filter tabs */}
          <div className="flex gap-1.5">
            {(['all', 'function', 'class', 'method'] as KindFilter[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                  kind === k
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {k === 'all' ? 'All' : KIND_LABELS[k].label}
              </button>
            ))}
          </div>
        </div>
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
                className="flex flex-col gap-3"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-6 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      <div className="ml-auto h-3 w-32 animate-pulse rounded bg-muted" />
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
                Failed to load symbols. Make sure the backend is running and the repo has been re-indexed.
              </motion.p>
            )}

            {/* Results */}
            {data && !isFetching && (
              <motion.div
                key={`results-${submitted}-${kind}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {results.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {submitted
                      ? <>No symbols matching <span className="font-medium text-foreground">&ldquo;{submitted}&rdquo;</span></>
                      : 'No symbols found. Re-index the repo to populate the symbol table.'}
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-xs text-muted-foreground">
                      {results.length} symbol{results.length !== 1 ? 's' : ''}
                      {submitted && <> for <span className="font-medium text-foreground">&ldquo;{submitted}&rdquo;</span></>}
                      {kind !== 'all' && <> · {KIND_LABELS[kind].label}s only</>}
                    </p>
                    <div className="flex flex-col gap-2">
                      {results.map((sym, i) => (
                        <SymbolRow key={sym.id} symbol={sym} index={i} repoId={repoId} />
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default NavigateView
