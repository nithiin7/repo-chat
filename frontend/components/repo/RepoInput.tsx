'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Link2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { indexRepo } from '@/lib/api/repos'
import { queryKeys } from '@/lib/api/queryKeys'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'indexing' | 'success' | 'error'

const RepoInput = () => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [feedback, setFeedback] = useState<{ message: string; sub?: string; variant: 'success' | 'error' } | null>(null)

  const { mutate: index } = useMutation({
    mutationFn: (repoUrl: string) =>
      indexRepo({ repo_url: repoUrl, github_token: token.trim() || undefined }),
    onSuccess: (result) => {
      setUrl('')
      setStatus('success')
      setFeedback({
        message: `Successfully indexed ${result.file_count.toLocaleString()} files`,
        sub: 'Your repository is ready — open a chat below',
        variant: 'success',
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos() })
      setTimeout(() => {
        setStatus('idle')
        setFeedback(null)
      }, 5000)
    },
    onError: (err) => {
      setStatus('error')
      setFeedback({
        message: err instanceof Error ? err.message : 'Failed to index repository',
        sub: 'Check the URL is correct. For private repos, add a GitHub token above.',
        variant: 'error',
      })
      setTimeout(() => {
        setStatus('idle')
        setFeedback(null)
        inputRef.current?.focus()
      }, 6000)
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || status === 'indexing') return
    setStatus('indexing')
    setFeedback(null)
    index(trimmed)
  }

  const borderColor = {
    idle: 'border-border focus-within:border-primary/60',
    indexing: 'border-primary/50',
    success: 'border-emerald-500/60',
    error: 'border-red-500/60',
  }[status]

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 bg-card p-1.5 transition-all duration-300',
            borderColor,
          )}
        >
          <div className="flex flex-1 items-center gap-2.5 pl-3">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or bitbucket.org/…"
              disabled={status === 'indexing'}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-60"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!url.trim() || status === 'indexing'}
            className={cn(
              'shrink-0 gap-2 rounded-lg px-5 font-semibold transition-all duration-200',
              status === 'success' && 'bg-emerald-600 hover:bg-emerald-600',
            )}
          >
            {status === 'indexing' ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Indexing…
              </>
            ) : (
              <>
                Index Repo
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        {/* Private repo token toggle */}
        <div className="mt-2 pl-1">
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Lock className="size-3" />
            {showToken ? 'Hide token' : 'Private repo? Add a GitHub token'}
          </button>
        </div>

        <AnimatePresence>
          {showToken && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="GitHub personal access token (repo scope)"
                  disabled={status === 'indexing'}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-60"
                />
              </div>
              <p className="mt-1 pl-1 text-xs text-muted-foreground/70">
                Token is sent only for this request and never stored.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Feedback banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-3 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm',
                feedback.variant === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                feedback.variant === 'error' && 'bg-red-500/10 text-red-700 dark:text-red-300',
              )}
            >
              {feedback.variant === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="font-medium">{feedback.message}</p>
                {feedback.sub && (
                  <p className="mt-0.5 opacity-75">{feedback.sub}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RepoInput
