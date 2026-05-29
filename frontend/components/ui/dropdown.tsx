'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownOption {
  value: string
  label?: string
}

interface DropdownProps {
  options: DropdownOption[] | string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const toOption = (o: DropdownOption | string): DropdownOption =>
  typeof o === 'string' ? { value: o, label: o } : o

export const Dropdown = ({ options, value, onChange, placeholder = 'Select…', className }: DropdownProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const normalised = options.map(toOption)
  const selected = normalised.find(o => o.value === value)

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors',
          'hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring',
          open && 'ring-1 ring-ring',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground/50')}>
          {selected?.label ?? selected?.value ?? placeholder}
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {/* Options panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg shadow-black/10">
          <div className="max-h-60 overflow-y-auto py-1">
            {normalised.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No options</div>
            ) : (
              normalised.map(option => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { onChange(option.value); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="flex-1 truncate">{option.label ?? option.value}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-indigo-400" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
