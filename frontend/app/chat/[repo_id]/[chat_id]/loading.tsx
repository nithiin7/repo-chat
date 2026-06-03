export default function Loading() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-border bg-background/90 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Back button */}
          <div className="bg-muted size-8 animate-pulse rounded-lg" />

          <div className="bg-border mx-1 h-5 w-px" />

          {/* Sidebar toggle */}
          <div className="bg-muted size-8 animate-pulse rounded-lg" />

          <div className="bg-border mx-1 h-5 w-px" />

          {/* Repo icon */}
          <div className="size-8 animate-pulse rounded-lg bg-indigo-500/10" />

          {/* Repo name + file count */}
          <div className="flex flex-col gap-1.5">
            <div className="bg-muted h-3.5 w-32 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-20 animate-pulse rounded" />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* LLM toggle */}
          <div className="bg-muted h-8 w-24 animate-pulse rounded-lg" />
          {/* Theme toggle */}
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="border-border w-55 shrink-0 space-y-1.5 border-r px-3 py-4">
          {/* New chat button */}
          <div className="bg-muted mb-3 h-8 w-full animate-pulse rounded-lg" />
          {[60, 80, 50, 70].map((w, i) => (
            <div
              key={i}
              className="bg-muted h-8 animate-pulse rounded-lg"
              style={{ width: `${w}%` }}
            />
          ))}
        </aside>

        {/* Main chat column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Empty-state skeleton */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-8 pb-16 text-center">
            {/* Sparkles icon */}
            <div className="border-border bg-card size-14 animate-pulse rounded-2xl border" />

            {/* Heading + subtext */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-muted h-4 w-56 animate-pulse rounded" />
              <div className="bg-muted h-3 w-40 animate-pulse rounded" />
            </div>

            {/* Suggestion chips */}
            <div className="grid w-full max-w-lg grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="border-border bg-card/60 h-16 animate-pulse rounded-xl border"
                />
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div className="border-border bg-background/90 shrink-0 border-t px-4 py-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <div className="border-border bg-card h-10 flex-1 animate-pulse rounded-xl border" />
              <div className="bg-muted h-10 w-9 animate-pulse rounded-xl" />
            </div>
            <div className="bg-muted/50 mx-auto mt-2.5 h-2.5 w-64 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
