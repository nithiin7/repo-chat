'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Bot, User, Files } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { cn } from '@/lib/utils'
import SourceDrawer from './SourceDrawer'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  onSuggestionClick?: (question: string) => void
}

const MessageBubble = ({ message, onSuggestionClick }: MessageBubbleProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isUser = message.role === 'user'
  const hasSources = !message.streaming && (message.sources?.length ?? 0) > 0
  const hasSuggestions = !message.streaming && !message.error && (message.suggestions?.length ?? 0) > 0
  const loadingSuggestions = !message.streaming && !message.error && message.suggestionsLoading

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn('mb-6 flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-indigo-500/20 text-indigo-500' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Bubble + actions */}
      <div className={cn('flex max-w-[82%] flex-col gap-1.5', isUser && 'items-end')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-indigo-500/20 px-4 py-2.5 text-sm leading-relaxed text-foreground ring-1 ring-indigo-500/20">
            {message.content}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed',
              message.error
                ? 'border border-red-500/20 bg-red-500/5 text-red-400'
                : 'bg-card text-foreground ring-1 ring-white/5',
            )}
          >
            {message.error && (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-400">
                <AlertCircle className="size-3.5" />
                Error
              </div>
            )}

            {/* Content or loading dots */}
            {!message.content && message.streaming ? (
              <div className="flex items-center gap-1 py-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                prose-headings:font-semibold prose-headings:text-foreground
                prose-p:text-foreground prose-p:leading-relaxed
                prose-strong:text-foreground prose-strong:font-semibold
                prose-code:text-indigo-300 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-transparent prose-pre:p-0
                prose-ol:text-foreground prose-ul:text-foreground
                prose-li:text-foreground prose-li:marker:text-muted-foreground
                prose-blockquote:border-indigo-500/40 prose-blockquote:text-muted-foreground
                prose-hr:border-border">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {message.content}
                </ReactMarkdown>
                {message.streaming && (
                  <span className="ml-0.5 inline-block h-[1em] w-0.5 -mb-px animate-pulse bg-indigo-400 align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* View Sources button */}
        {hasSources && (
          <>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-indigo-500"
            >
              <Files className="size-3.5" />
              View {message.sources!.length} source{message.sources!.length !== 1 ? 's' : ''}
            </button>

            <SourceDrawer
              sources={message.sources!}
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
            />
          </>
        )}

        {/* Suggestion loading skeleton */}
        {loadingSuggestions && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[72, 96, 80].map((w) => (
              <div
                key={w}
                style={{ width: w }}
                className="h-7 animate-pulse rounded-lg bg-muted/60"
              />
            ))}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {hasSuggestions && onSuggestionClick && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {message.suggestions!.map((q) => (
              <button
                key={q}
                onClick={() => onSuggestionClick(q)}
                className="cursor-pointer rounded-lg border border-border bg-card/60 px-3 py-1.5 text-left text-xs text-muted-foreground transition-[border-color,background-color,color] duration-150 hover:border-indigo-500/30 hover:bg-card hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default MessageBubble
