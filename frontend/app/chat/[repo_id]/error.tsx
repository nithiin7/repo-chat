'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
        >
          <ArrowLeft className="size-3.5" />
          Repositories
        </Link>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertCircle className="size-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Chat failed to load</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error.message || 'Could not load the chat session. The backend may be unreachable.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants(), 'gap-2')}>
            <ArrowLeft className="size-3.5" />
            Back to repos
          </Link>
        </div>
      </main>
    </div>
  )
}
