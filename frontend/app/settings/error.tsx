'use client'

import Link from 'next/link'
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar hideSettings />

      {/* Page header */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            <ArrowLeft className="size-3.5" />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
