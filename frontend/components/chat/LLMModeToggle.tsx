'use client'

import { Cpu, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LLMMode } from '@/types'

interface LLMModeToggleProps {
  mode: LLMMode
  onChange: (mode: LLMMode) => void
  disabled?: boolean
}

export default function LLMModeToggle({ mode, onChange, disabled }: LLMModeToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
      <button
        type="button"
        onClick={() => onChange('local')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:pointer-events-none',
          mode === 'local'
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Cpu className="size-3.5" />
        Local
      </button>
      <button
        type="button"
        onClick={() => onChange('cloud')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:pointer-events-none',
          mode === 'cloud'
            ? 'bg-indigo-500/15 text-indigo-400'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Cloud className="size-3.5" />
        Cloud
      </button>
    </div>
  )
}
