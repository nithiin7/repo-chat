'use client'

import { useState } from 'react'
import { Files, FileCode, Copy, Check, ExternalLink } from 'lucide-react'
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
  repoUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildFileUrl(repoUrl: string, filePath: string): string | null {
  try {
    const base = repoUrl.replace(/\.git$/, '').replace(/\/$/, '')
    const { hostname, pathname } = new URL(base)

    // file_path is stored as an absolute local path like /…/repos/<repoName>/src/foo.ts
    // Strip everything up to and including /<repoName>/ to get the relative path
    const repoName = pathname.split('/').filter(Boolean).pop() ?? ''
    const marker = `/${repoName}/`
    const idx = filePath.indexOf(marker)
    const relative = idx >= 0 ? filePath.slice(idx + marker.length) : filePath.replace(/^\//, '')

    if (hostname === 'github.com') return `${base}/blob/HEAD/${relative}`
    if (hostname === 'bitbucket.org') return `${base}/src/HEAD/${relative}`
    if (hostname.includes('gitlab')) return `${base}/-/blob/HEAD/${relative}`
    return null
  } catch {
    return null
  }
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

const SourceDrawer = ({ sources, repoUrl, open, onOpenChange }: SourceDrawerProps) => {
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
              const fileUrl = repoUrl ? buildFileUrl(repoUrl, src.file_path) : null

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
                    <div className="flex shrink-0 items-center gap-2">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open in repository"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-indigo-400"
                        >
                          <ExternalLink className="size-3" />
                          Open
                        </a>
                      )}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                          color,
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
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
