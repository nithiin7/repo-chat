'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SettingsError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => (
  <div className="flex min-h-screen flex-col">
    <NavBar hideSettings />

    <div className="border-b border-border/50 bg-muted/30">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-10">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
        >
          <ArrowLeft className="size-3.5" />
          Home
        </Link>
        <span className="text-border">/</span>
        <span className="text-sm font-medium">Settings</span>
      </div>
    </div>

    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Settings failed to load</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error.message || 'Could not load settings. Make sure the backend is running.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
        <Link href="/dashboard" className={cn(buttonVariants(), 'gap-2')}>
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>
      </div>
    </main>
  </div>
)

export default SettingsError
