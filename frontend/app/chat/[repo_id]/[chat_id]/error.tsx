"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground text-sm">Something went wrong loading this chat.</p>
      <button
        onClick={reset}
        className="border-border hover:bg-muted rounded-lg border px-4 py-2 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
