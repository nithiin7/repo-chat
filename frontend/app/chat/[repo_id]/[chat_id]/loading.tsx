export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Back button */}
          <div className="size-8 animate-pulse rounded-lg bg-muted" />

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Sidebar toggle */}
          <div className="size-8 animate-pulse rounded-lg bg-muted" />

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Repo icon */}
          <div className="size-8 animate-pulse rounded-lg bg-indigo-500/10" />

          {/* Repo name + file count */}
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* LLM toggle */}
          <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          {/* Theme toggle */}
          <div className="size-8 animate-pulse rounded-lg bg-muted" />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-55 shrink-0 border-r border-border px-3 py-4 space-y-1.5">
          {/* New chat button */}
          <div className="mb-3 h-8 w-full animate-pulse rounded-lg bg-muted" />
          {[60, 80, 50, 70].map((w, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-lg bg-muted"
              style={{ width: `${w}%` }}
            />
          ))}
        </aside>

        {/* Main chat column */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Empty-state skeleton */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 pt-8 text-center">
            {/* Sparkles icon */}
            <div className="size-14 animate-pulse rounded-2xl border border-border bg-card" />

            {/* Heading + subtext */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>

            {/* Suggestion chips */}
            <div className="grid w-full max-w-lg grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-border bg-card/60"
                />
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-border bg-background/90 px-4 py-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="flex-1 h-10 animate-pulse rounded-xl border border-border bg-card" />
              <div className="h-10 w-9 animate-pulse rounded-xl bg-muted" />
            </div>
            <div className="mt-2.5 mx-auto h-2.5 w-64 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      </div>
    </div>
  )
}
