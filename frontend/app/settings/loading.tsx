import { Skeleton } from '@/components/ui/skeleton'
import { NavBar } from '@/components/ui/nav-bar'

const SettingsSectionSkeleton = () => (
  <div className="flex flex-col rounded-xl border border-border bg-card p-6">
    <div className="mb-6 flex items-center gap-3">
      <Skeleton className="size-8 rounded-lg" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-10 rounded-md" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <div className="flex gap-1 self-start rounded-lg border border-border bg-card p-0.5">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-12 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>
    </div>
  </div>
)

export const SettingsSkeleton = () => (
  <>
    <div className="mb-8 space-y-2">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8">
      <SettingsSectionSkeleton />
      <SettingsSectionSkeleton />
    </div>
    <div className="mt-8 border-t border-border pt-6">
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  </>
)

const SettingsLoading = () => (
  <div className="flex min-h-screen flex-col">
    <NavBar hideSettings />

    <div className="border-b border-border/50 bg-muted/30">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-10">
        <Skeleton className="h-5 w-12" />
        <span className="text-border">/</span>
        <Skeleton className="h-5 w-16" />
      </div>
    </div>

    <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-10 sm:px-6 lg:px-10">
      <SettingsSkeleton />
    </main>
  </div>
)

export default SettingsLoading
