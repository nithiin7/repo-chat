export default function Loading() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="border-border bg-background/90 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Back */}
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
          {/* Icon buttons: ListTree, Search, Share2, Activity, Download, DiffPanel */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-muted size-8 animate-pulse rounded-lg" />
          ))}
          {/* LLM mode toggle — pill with two segments */}
          <div className="bg-card border-border h-8 w-32 animate-pulse rounded-lg border" />
          {/* Theme toggle */}
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar — 260px matches w-65 in ChatWindow */}
        <aside className="border-border w-65 shrink-0 border-r">
          {/* Header row: "Chats" label + new chat button */}
          <div className="flex items-center justify-between px-3 py-3">
            <div className="bg-muted h-3 w-10 animate-pulse rounded" />
            <div className="bg-muted size-7 animate-pulse rounded-md" />
          </div>
          {/* Chat list items */}
          <div className="space-y-0.5 px-2">
            {[80, 65, 90, 55, 75].map((w, i) => (
              <div
                key={i}
                className="bg-muted h-8 animate-pulse rounded-lg"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </aside>

        {/* Main chat column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Empty state skeleton */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-8 pb-16">
            {/* Sparkles icon */}
            <div className="border-border bg-card size-14 animate-pulse rounded-2xl border" />

            {/* Heading + subtext */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-muted h-4 w-56 animate-pulse rounded" />
              <div className="bg-muted h-3 w-40 animate-pulse rounded" />
            </div>

            {/* Onboarding card */}
            <div className="h-13 w-full max-w-lg animate-pulse rounded-xl border border-indigo-500/20 bg-indigo-500/5" />

            {/* Suggestion chips — 1-col on mobile, 2-col on sm+ */}
            <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="border-border bg-card/60 h-11 animate-pulse rounded-xl border"
                />
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div className="border-border bg-background/90 shrink-0 border-t px-4 py-4">
            <div className="mx-auto max-w-3xl">
              {/* Input card */}
              <div className="bg-card border-border rounded-xl border">
                {/* Textarea area */}
                <div className="h-18" />
                {/* Bottom bar: model picker + scope selector + send button */}
                <div className="flex items-center justify-between px-3 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted h-7 w-24 animate-pulse rounded-md" />
                    <div className="bg-muted h-7 w-16 animate-pulse rounded-md" />
                  </div>
                  <div className="size-8 animate-pulse rounded-lg bg-indigo-500/20" />
                </div>
              </div>
            </div>
            <div className="bg-muted/50 mx-auto mt-2.5 h-2.5 w-64 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
