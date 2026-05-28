'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { indexRepo } from '@/lib/api'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'indexing' | 'success' | 'error'

export default function RepoInput() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [feedback, setFeedback] = useState<{ message: string; sub?: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || status === 'indexing') return

    setStatus('indexing')
    setFeedback(null)

    try {
      const result = await indexRepo({ repo_url: trimmed })
      setUrl('')
      setStatus('success')
      setFeedback({
        message: `Successfully indexed ${result.file_count.toLocaleString()} files`,
        sub: 'Your repository is ready — open a chat below',
      })
      router.refresh()
      setTimeout(() => {
        setStatus('idle')
        setFeedback(null)
      }, 5000)
    } catch (err) {
      setStatus('error')
      setFeedback({
        message: err instanceof Error ? err.message : 'Failed to index repository',
        sub: 'Check the URL and make sure it points to a public repo',
      })
      setTimeout(() => {
        setStatus('idle')
        setFeedback(null)
        inputRef.current?.focus()
      }, 6000)
    }
  }

  const borderColor = {
    idle: 'border-white/20 focus-within:border-indigo-400/80',
    indexing: 'border-indigo-400/60',
    success: 'border-emerald-400/70',
    error: 'border-red-400/70',
  }[status]

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 bg-white/10 p-1.5 backdrop-blur-sm transition-all duration-300',
            borderColor,
          )}
        >
          <div className="flex flex-1 items-center gap-2.5 pl-3">
            <Link2 className="size-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo  or  bitbucket.org/…"
              disabled={status === 'indexing'}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder:text-slate-500 outline-none disabled:opacity-60"
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
      </form>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={cn(
            'mt-3 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm',
            status === 'success' && 'bg-emerald-500/15 text-emerald-300',
            status === 'error' && 'bg-red-500/15 text-red-300',
          )}
        >
          {status === 'success' ? (
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
      )}
    </div>
  )
}
