'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { GitFork, MessageSquare, Trash2, Loader2, FileCode2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteRepo } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Repo } from '@/types'

export default function RepoCard({ repo, index = 0 }: { repo: Repo; index?: number }) {
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
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5',
        'transition-[border-color,background-color,box-shadow] duration-200 hover:border-indigo-500/30 hover:bg-card/80 hover:shadow-lg hover:shadow-indigo-500/5',
        deleting && 'pointer-events-none opacity-40',
      )}
    >
      {/* Delete button — visible on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Delete repository"
        className="absolute right-3 top-3 cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
      >
        {deleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
          <GitFork className="size-4" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate font-semibold text-foreground">{displayName}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{repo.url}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileCode2 className="size-3.5" />
          {repo.file_count.toLocaleString()} files
        </span>
        <span className="opacity-30">·</span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
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
    </motion.article>
  )
}
