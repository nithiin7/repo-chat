import { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Input = ({ className, ...props }: ComponentProps<'input'>) => (
  <input
    className={cn(
      'w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring',
      className,
    )}
    {...props}
  />
)
