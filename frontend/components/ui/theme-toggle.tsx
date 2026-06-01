'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

const subscribe = () => () => {}
const useIsHydrated = () => useSyncExternalStore(subscribe, () => true, () => false)

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme()
  const mounted = useIsHydrated()

  if (!mounted) return <div className={cn('size-8', className)} />

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
