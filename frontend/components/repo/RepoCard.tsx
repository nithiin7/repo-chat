'use client'

import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GitBranch, GitFork, MessageSquare, Trash2, Loader2, FileCode2, Clock, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkRepoStatus, deleteRepo, indexRepo, syncRepo } from '@/lib/api/repos'
import { queryKeys } from '@/lib/api/queryKeys'
import { cn } from '@/lib/utils'
import type { Repo } from '@/types'

const RepoCard = ({ repo, index = 0 }: { repo: Repo; index?: number }) => {
  const router = useRouter()
  const queryClient = useQueryClient()

  const displayName = repo.name || repo.url.replace(/^https?:\/\//, '').split('/').slice(1, 3).join('/')
  const indexedAt = new Date(repo.indexed_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const { data: status } = useQuery({
    queryKey: queryKeys.repoStatus(repo.repo_id),
    queryFn: () => checkRepoStatus(repo.repo_id),
    staleTime: 60 * 1000,
    retry: false,
  })
  const hasUpdates = status?.has_updates ?? false

  const { mutate: handleDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteRepo(repo.repo_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.repos() }),
  })

  const { mutate: handleReindex, isPending: reindexing } = useMutation({
    mutationFn: () => indexRepo({ repo_url: repo.url, force: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus(repo.repo_id) })
    },
  })

  const { mutate: handleSync, isPending: syncing } = useMutation({
    mutationFn: () => syncRepo(repo.repo_id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus(repo.repo_id) })
    },
  })

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5',
        'transition-[border-color,background-color,box-shadow] duration-200 hover:border-indigo-500/30 hover:bg-card/80 hover:shadow-lg hover:shadow-indigo-500/5',
        hasUpdates && 'border-amber-500/30',
        (deleting || reindexing || syncing) && 'pointer-events-none opacity-40',
      )}
    >
      {/* Action buttons — visible on hover */}
      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={() => handleReindex()}
          disabled={reindexing}
          aria-label="Re-index repository"
          className={cn(
            'cursor-pointer rounded-md p-1.5 text-muted-foreground transition-all duration-150',
            hasUpdates
              ? 'opacity-100 text-amber-400 hover:bg-amber-500/10'
              : 'hover:bg-muted hover:text-foreground',
          )}
        >
          <RefreshCw className={cn('size-3.5', reindexing && 'animate-spin')} />
        </button>
        <button
          onClick={() => handleDelete()}
          disabled={deleting}
          aria-label="Delete repository"
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          hasUpdates ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400',
        )}>
          <GitFork className="size-4" />
        </div>
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="truncate font-semibold text-foreground">{displayName}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{repo.url}</p>
        </div>
      </div>

      {/* Updates badge */}
      {hasUpdates && (
        <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400">
          <RefreshCw className="size-3" />
          New commits available — sync to update
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileCode2 className="size-3.5" />
          {repo.file_count.toLocaleString()} files
        </span>
        <span className="opacity-30">·</span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {indexedAt}
        </span>
        {repo.branch && (
          <>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1 font-mono text-indigo-400">
              <GitBranch className="size-3.5" />
              {repo.branch}
            </span>
          </>
        )}
      </div>

      {/* CTA */}
      {hasUpdates ? (
        <div className="mt-auto flex gap-2">
          <Button
            onClick={() => handleSync()}
            disabled={syncing}
            size="sm"
            variant="outline"
            className="flex-1 gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            {syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          <Button
            onClick={() => router.push(`/chat/${repo.repo_id}`)}
            size="sm"
            className="flex-1 gap-2"
          >
            <MessageSquare className="size-3.5" />
            Open Chat
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex gap-2">
          <Button
            onClick={() => router.push(`/search/${repo.repo_id}`)}
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
          >
            <Search className="size-3.5" />
            Search
          </Button>
          <Button
            onClick={() => router.push(`/chat/${repo.repo_id}`)}
            size="sm"
            className="flex-1 gap-2"
          >
            <MessageSquare className="size-3.5" />
            Open Chat
          </Button>
        </div>
      )}
    </motion.article>
  )
}

export default RepoCard
