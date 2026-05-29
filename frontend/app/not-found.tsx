import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NotFound = () => (
  <div className="flex min-h-screen flex-col">
    <NavBar transparent />
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
        <FileQuestion className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="text-5xl font-bold tracking-tight text-muted-foreground/30">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants(), 'gap-2')}>
        <Home className="size-3.5" />
        Back to home
      </Link>
    </main>
  </div>
)

export default NotFound
