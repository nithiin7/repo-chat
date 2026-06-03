'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, GitCompare } from 'lucide-react'
import RepoCard from './RepoCard'
import MultiRepoChatDialog from '@/components/chat/MultiRepoChatDialog'
import { listRepos } from '@/lib/api/repos'
import { queryKeys } from '@/lib/api/queryKeys'
import type { Repo } from '@/types'

const RepoList = ({ initialRepos }: { initialRepos: Repo[] }) => {
  const { data: repos = [] } = useQuery({
    queryKey: queryKeys.repos(),
    queryFn: listRepos,
    initialData: initialRepos,
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedRepos = repos.filter((r) => selectedIds.has(r.repo_id))

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"
        >
          <BookOpen className="size-7 text-muted-foreground" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <p className="font-semibold text-foreground">No repositories indexed yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a GitHub or Bitbucket URL above to get started
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-5 flex items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-foreground">Your Repositories</h2>
          <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
            {repos.length}
          </span>
        </div>

        <AnimatePresence>
          {selectedIds.size >= 2 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.15 }}
              onClick={() => setCompareOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-sm font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/25"
            >
              <GitCompare className="size-3.5" />
              Compare {selectedIds.size} repos
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {selectedIds.size > 0 && selectedIds.size < 2 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Select one more repo to compare
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo, i) => (
          <RepoCard
            key={repo.repo_id}
            repo={repo}
            index={i}
            selected={selectedIds.has(repo.repo_id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {compareOpen && (
        <MultiRepoChatDialog
          repos={selectedRepos}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </section>
  )
}

export default RepoList
