'use client'

import { useState } from 'react'
import { Files, FileCode, Copy, Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { SourceChunk } from '@/types'

interface SourceDrawerProps {
  sources: SourceChunk[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const scoreLabel = (score: number) => {
  const pct = Math.round(score * 100)
  const color =
    pct >= 85
      ? 'bg-emerald-500/15 text-emerald-400'
      : pct >= 70
        ? 'bg-amber-500/15 text-amber-400'
        : pct >= 50
          ? 'bg-orange-500/15 text-orange-400'
          : 'bg-red-500/15 text-red-400'
  return { pct, color }
}

const SourceDrawer = ({ sources, open, onOpenChange }: SourceDrawerProps) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => onOpenChange(o)}>
      <SheetContent
        side="right"
        className="flex flex-col border-border bg-background p-0 text-foreground data-[side=right]:sm:max-w-xl"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Files className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold text-foreground">
                Sources
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {sources.length} file{sources.length !== 1 ? 's' : ''} referenced in this answer
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {sources.map((src, i) => {
              const segments = src.file_path.split('/')
              const filename = segments.pop() ?? src.file_path
              const dir = segments.length > 0 ? segments.join('/') + '/' : ''
              const { pct, color } = scoreLabel(src.score)

              return (
                <div
                  key={i}
                  className="group overflow-hidden rounded-xl border border-border bg-card"
                >
                  {/* File path row */}
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate font-mono text-xs">
                        {dir && <span className="text-muted-foreground">{dir}</span>}
                        <span className="font-medium text-foreground">{filename}</span>
                      </span>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                        color,
                      )}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Code chunk */}
                  <div className="relative">
                    <pre className="max-h-60 overflow-auto p-4 text-xs leading-relaxed text-foreground/80">
                      <code className="font-mono">{src.chunk}</code>
                    </pre>

                    {/* Copy button — visible on hover */}
                    <button
                      onClick={() => copy(src.chunk, i)}
                      aria-label="Copy code"
                      className={cn(
                        'absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150',
                        copiedIdx === i
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-card border border-border text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground',
                      )}
                    >
                      {copiedIdx === i ? (
                        <>
                          <Check className="size-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default SourceDrawer
