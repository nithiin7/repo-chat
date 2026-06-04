function MessageSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[75%] flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}
      >
        <div
          className={`bg-muted animate-pulse rounded-2xl ${align === "right" ? "h-14 w-52 rounded-tr-sm" : "h-20 w-72 rounded-tl-sm"}`}
        />
        <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
      </div>
    </div>
  );
}

export default function ChatLoading() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="border-border bg-background/90 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
          <div className="bg-border mx-1 h-5 w-px" />
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
          <div className="bg-border mx-1 h-5 w-px" />
          <div className="size-8 animate-pulse rounded-lg bg-indigo-500/10" />
          <div className="flex flex-col gap-1.5">
            <div className="bg-muted h-3.5 w-32 animate-pulse rounded" />
            <div className="bg-muted h-2.5 w-20 animate-pulse rounded" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-muted size-8 animate-pulse rounded-lg" />
          ))}
          <div className="bg-card border-border h-8 w-32 animate-pulse rounded-lg border" />
          <div className="bg-muted size-8 animate-pulse rounded-lg" />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="border-border w-65 shrink-0 border-r">
          <div className="flex items-center justify-between px-3 py-3">
            <div className="bg-muted h-3 w-10 animate-pulse rounded" />
            <div className="bg-muted size-7 animate-pulse rounded-md" />
          </div>
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

        {/* Messages */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-hidden px-4 py-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <MessageSkeleton align="right" />
              <MessageSkeleton align="left" />
              <MessageSkeleton align="right" />
              <MessageSkeleton align="left" />
            </div>
          </div>

          {/* Input bar */}
          <div className="border-border bg-background/90 shrink-0 border-t px-4 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="bg-card border-border rounded-xl border">
                <div className="h-18" />
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
