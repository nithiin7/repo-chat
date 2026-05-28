'use client'

import { useState } from 'react'
import { AlertCircle, Bot, User, Files } from 'lucide-react'
import { cn } from '@/lib/utils'
import SourceDrawer from './SourceDrawer'
import type { Message } from '@/types'

export default function MessageBubble({ message }: { message: Message }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isUser = message.role === 'user'
  const hasSources = !message.streaming && (message.sources?.length ?? 0) > 0

  return (
    <div className={cn('mb-6 flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400',
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Bubble + actions */}
      <div className={cn('flex max-w-[82%] flex-col gap-1.5', isUser && 'items-end')}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white">
            {message.content}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed',
              message.error
                ? 'border border-red-900/50 bg-red-950/40 text-red-300'
                : 'bg-slate-800/70 text-slate-200',
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
                <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap wrap-break-word font-[inherit]">
                {message.content}
                {message.streaming && (
                  <span className="ml-0.5 inline-block h-[1em] w-0.5 -mb-px animate-pulse bg-indigo-400 align-middle" />
                )}
              </pre>
            )}
          </div>
        )}

        {/* View Sources button */}
        {hasSources && (
          <>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-indigo-400"
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
      </div>
    </div>
  )
}
