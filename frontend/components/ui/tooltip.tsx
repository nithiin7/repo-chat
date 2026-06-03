'use client'

import * as React from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

interface TipProps {
  label: string
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tip({ label, children, side = 'bottom', delay = 500 }: TipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={delay} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} align="center" className="z-9999">
          <Tooltip.Popup
            className={cn(
              'max-w-50 rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md',
              'origin-(--transform-origin)',
              'transition-[opacity,transform] duration-80 ease-out',
              'data-open:opacity-100 data-open:scale-100',
              'data-closed:opacity-0 data-closed:scale-95',
              'data-starting-style:opacity-0 data-starting-style:scale-95',
            )}
          >
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
