'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Something went wrong loading this chat.</p>
      <button
        onClick={reset}
        className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
      >
        Try again
      </button>
    </div>
  )
}
