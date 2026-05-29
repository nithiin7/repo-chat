import Link from 'next/link'
import { CodeXml, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { cn } from '@/lib/utils'

interface NavBarProps {
  hideSettings?: boolean
  /** No background or border — lets a gradient behind it show through */
  transparent?: boolean
}

export const NavBar = ({ hideSettings = false, transparent = false }: NavBarProps) => (
  <nav className={cn(
    'sticky top-0 z-40',
    transparent
      ? 'border-b border-transparent bg-transparent'
      : 'border-b border-border/50 bg-background/80 backdrop-blur-md',
  )}>
    <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-10">
      <Link href="/dashboard" className="flex items-center gap-2.5 text-sm font-semibold">
        <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
          <CodeXml className="size-4 text-indigo-500" />
        </div>
        <span>CodeLens</span>
      </Link>

      <div className="flex items-center gap-1">
        {!hideSettings && (
          <Link
            href="/settings"
            className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
        )}
        <ThemeToggle />
      </div>
    </div>
  </nav>
)
