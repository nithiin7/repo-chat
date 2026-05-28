import { Skeleton } from '@/components/ui/skeleton'

function MessageSkeleton({ align }: { align: 'left' | 'right' }) {
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[75%] flex-col gap-1 ${align === 'right' ? 'items-end' : 'items-start'}`}>
        <Skeleton className={`h-16 rounded-2xl ${align === 'right' ? 'w-52 rounded-tr-sm' : 'w-72 rounded-tl-sm'}`} />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export default function ChatLoading() {
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <MessageSkeleton align="right" />
          <MessageSkeleton align="left" />
          <MessageSkeleton align="right" />
          <MessageSkeleton align="left" />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-md">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
