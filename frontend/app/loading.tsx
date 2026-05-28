import { Skeleton } from '@/components/ui/skeleton'

function RepoCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 size-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2 pr-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

export default function HomeLoading() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-15%] h-175 w-225 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-96 w-96 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      {/* Navbar skeleton */}
      <nav className="sticky top-0 z-40 border-b border-transparent bg-transparent">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <Skeleton className="h-5 w-28" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        </div>
      </nav>

      {/* Hero skeleton */}
      <header className="relative px-4 pb-28 pt-16 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <Skeleton className="h-5 w-36 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="mx-auto h-12 w-[480px] max-w-full" />
            <Skeleton className="mx-auto h-12 w-[360px] max-w-full" />
          </div>
          <Skeleton className="mx-auto h-4 w-[340px] max-w-full" />
          <Skeleton className="mt-2 h-14 w-full max-w-xl rounded-xl" />
        </div>
      </header>

      {/* Repo grid skeleton */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-10 py-12">
        <div className="mb-5 flex items-center gap-2.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RepoCardSkeleton />
          <RepoCardSkeleton />
          <RepoCardSkeleton />
        </div>
      </main>
    </div>
  )
}
