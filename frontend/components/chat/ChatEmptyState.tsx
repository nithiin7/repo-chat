'use client'

import { motion } from 'framer-motion'
import { BookOpen, Sparkles } from 'lucide-react'
import type { LLMMode, Repo } from '@/types'

const ONBOARDING_PROMPT =
  'Generate an onboarding guide for a new developer joining this codebase. Cover: what this project does, its overall architecture and tech stack, the main entry points and how the application starts, key directories and what lives in each, and how data flows through the system end to end.'

const SUGGESTIONS = [
  'What does this codebase do?',
  'What are the main entry points?',
  'How is authentication handled?',
  'Explain the folder structure',
]

interface ChatEmptyStateProps {
  repo: Repo | null
  mode: LLMMode
  onSuggestionClick: (suggestion: string) => void
}

const ChatEmptyState = ({ repo, mode, onSuggestionClick }: ChatEmptyStateProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6 px-4 pb-16 pt-8 text-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-indigo-400"
    >
      <Sparkles className="size-6" />
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <p className="font-semibold text-foreground">Ask anything about this codebase</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {repo
          ? `${repo.file_count.toLocaleString()} files indexed · ${mode === 'local' ? 'local LLM' : 'cloud LLM'}`
          : 'Repository is indexed and ready'}
      </p>
    </motion.div>

    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2 }}
      onClick={() => onSuggestionClick(ONBOARDING_PROMPT)}
      className="flex w-full max-w-lg cursor-pointer items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 text-left transition-[border-color,background-color] duration-150 hover:border-indigo-500/50 hover:bg-indigo-500/10"
    >
      <BookOpen className="size-4 shrink-0 text-indigo-400" />
      <div>
        <p className="text-sm font-medium text-foreground">Generate onboarding doc</p>
        <p className="text-xs text-muted-foreground">One-click summary for new developers</p>
      </div>
    </motion.button>

    <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
      {SUGGESTIONS.map((s, i) => (
        <motion.button
          key={s}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.22 + i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
          whileHover={{ y: -2 }}
          onClick={() => onSuggestionClick(s)}
          className="cursor-pointer rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm text-muted-foreground transition-[border-color,background-color,color] duration-150 hover:border-indigo-500/30 hover:bg-card hover:text-foreground"
        >
          {s}
        </motion.button>
      ))}
    </div>
  </div>
)

export default ChatEmptyState
