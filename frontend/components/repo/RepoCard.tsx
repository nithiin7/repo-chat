'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitFork, MessageSquare, Trash2, Loader2, FileCode2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteRepo } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Repo } from '@/types'

export default function RepoCard({ repo }: { repo: Repo }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const displayName = repo.name || repo.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/')
  const indexedAt = new Date(repo.indexed_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteRepo(repo.repo_id)
      router.refresh()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        'transition-all duration-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/60',
        deleting && 'pointer-events-none opacity-40',
      )}
    >
      {/* Delete button — visible on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete repository"
        className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 opacity-0 transition-all duration-150 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        {deleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <GitFork className="size-4" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate font-semibold text-slate-900">{displayName}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">{repo.url}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <FileCode2 className="size-3.5 text-slate-400" />
          {repo.file_count.toLocaleString()} files
        </span>
        <span className="text-slate-300">·</span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-slate-400" />
          {indexedAt}
        </span>
      </div>

      {/* CTA */}
      <Button
        onClick={() => router.push(`/chat/${repo.repo_id}`)}
        size="sm"
        className="mt-auto w-full gap-2"
      >
        <MessageSquare className="size-3.5" />
        Open Chat
      </Button>
    </article>
  )
}
