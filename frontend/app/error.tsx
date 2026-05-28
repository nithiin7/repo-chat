'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar transparent />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertCircle className="size-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred. Try refreshing or go back home.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
          <Link href="/" className={cn(buttonVariants(), 'gap-2')}>
            <Home className="size-3.5" />
            Go home
          </Link>
        </div>
      </main>
    </div>
  )
}
