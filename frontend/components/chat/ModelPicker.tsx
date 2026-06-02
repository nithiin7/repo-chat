'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dropdown } from '@/components/ui/dropdown'
import { getSettings, getOllamaModels, updateSettings } from '@/lib/api/settings'
import { queryKeys } from '@/lib/api/queryKeys'
import { cn } from '@/lib/utils'
import type { CloudProvider, LLMMode, Settings, SettingsUpdate } from '@/types'

const CLOUD_PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
]

type ModelOption = { value: string; label: string }

const CLOUD_MODELS: Record<CloudProvider, ModelOption[]> = {
  anthropic: [
    { value: 'claude-opus-4-8', label: 'Opus 4.8 — most capable' },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — balanced' },
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — fast & efficient' },
    { value: 'claude-3-8-sonnet', label: 'Claude 3.8 Sonnet' },
    { value: 'claude-opus-4-5', label: 'Opus 4.5' },
    { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
    { value: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus — legacy' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku — legacy' },
  ],
  openai: [
    { value: 'gpt-5', label: 'GPT-5 — most capable' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini — fast & affordable' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3-mini — advanced reasoning' },
    { value: 'o1', label: 'o1 — reasoning' },
    { value: 'o1-mini', label: 'o1-mini — reasoning, fast' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo — legacy' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo — legacy' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3, latest' },
    { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1, large' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1, fast' },
    { value: 'llama3-70b-8192', label: 'Llama 3, large' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral MoE' },
    { value: 'gemma2-9b-it', label: 'Gemma 2' },
  ],
  gemini: [
    { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro — most capable' },
    { value: 'gemini-3.0-flash', label: 'Gemini 3.0 Flash — fast' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro — legacy' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash — legacy' },
  ],
}

function modelForProvider(settings: Settings, provider: CloudProvider): string {
  switch (provider) {
    case 'anthropic': return settings.anthropic_model
    case 'openai': return settings.openai_model
    case 'groq': return settings.groq_model
    case 'gemini': return settings.gemini_model
  }
}

interface ModelPickerProps {
  mode: LLMMode
  disabled?: boolean
}

const ModelPicker = ({ mode, disabled }: ModelPickerProps) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: getSettings,
  })

  const { data: ollamaModels = [] } = useQuery({
    queryKey: queryKeys.ollamaModels(),
    queryFn: getOllamaModels,
    enabled: mode === 'local' && open,
  })

  // Tracks which provider the user is browsing (not yet saved)
  const [browsingProvider, setBrowsingProvider] = useState<CloudProvider | null>(null)
  const activeProvider = browsingProvider ?? settings?.cloud_provider ?? 'anthropic'

  const currentDisplayModel = settings
    ? mode === 'local'
      ? settings.ollama_model || '—'
      : modelForProvider(settings, settings.cloud_provider) || '—'
    : '…'

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings(), updated)
      setOpen(false)
      setBrowsingProvider(null)
    },
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setBrowsingProvider(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function handleLocalModelSelect(model: string) {
    saveMutation.mutate({ ollama_model: model })
  }

  function handleCloudModelSelect(model: string) {
    const update: SettingsUpdate = { cloud_provider: activeProvider }
    switch (activeProvider) {
      case 'anthropic': update.anthropic_model = model; break
      case 'openai': update.openai_model = model; break
      case 'groq': update.groq_model = model; break
      case 'gemini': update.gemini_model = model; break
    }
    saveMutation.mutate(update)
  }

  const savedModelForActiveProvider = settings ? modelForProvider(settings, activeProvider) : ''

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || !settings}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          open && 'bg-muted text-foreground',
          (disabled || !settings) && 'pointer-events-none opacity-50',
        )}
      >
        <span className="max-w-36 truncate font-mono">{currentDisplayModel}</span>
        <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-30 w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {mode === 'local' ? (
            <div className="p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ollama model</p>
              {(ollamaModels as string[]).length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  {(ollamaModels as string[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleLocalModelSelect(m)}
                      disabled={saveMutation.isPending}
                      className={cn(
                        'flex w-full items-center rounded-md px-2.5 py-1.5 text-left font-mono text-xs transition-colors hover:bg-muted disabled:opacity-50',
                        m === settings?.ollama_model
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'text-foreground',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">
                  No Ollama models found. Start Ollama and reload.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border">
                <Dropdown
                  options={CLOUD_PROVIDERS}
                  value={activeProvider}
                  onChange={v => setBrowsingProvider(v as CloudProvider)}
                />
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {CLOUD_MODELS[activeProvider].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => handleCloudModelSelect(m.value)}
                    disabled={saveMutation.isPending}
                    className={cn(
                      'flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50',
                      m.value === savedModelForActiveProvider && activeProvider === settings?.cloud_provider
                        ? 'bg-indigo-500/10'
                        : '',
                    )}
                  >
                    <span className={cn(
                      'font-mono text-xs',
                      m.value === savedModelForActiveProvider && activeProvider === settings?.cloud_provider
                        ? 'text-indigo-400'
                        : 'text-foreground',
                    )}>
                      {m.value}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ModelPicker
