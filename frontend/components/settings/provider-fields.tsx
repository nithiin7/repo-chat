'use client'

import { Check, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field } from './section'

export const KeyBadge = () => (
  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
    <Check className="size-3" />
    Configured
  </span>
)

export const KeyInput = ({
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  placeholder: string
}) => (
  <div className="relative">
    <Input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="pr-10"
    />
    <button
      type="button"
      onClick={onToggleShow}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
    >
      {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  </div>
)

export const ProviderFields = ({
  model, onModelChange, modelPlaceholder,
  baseUrl, onBaseUrlChange,
  apiKey, onApiKeyChange,
  showKey, onToggleKey,
  keyPlaceholder, hasKey,
}: {
  model: string
  onModelChange: (v: string) => void
  modelPlaceholder: string
  baseUrl?: string
  onBaseUrlChange?: (v: string) => void
  apiKey: string
  onApiKeyChange: (v: string) => void
  showKey: boolean
  onToggleKey: () => void
  keyPlaceholder: string
  hasKey: boolean
}) => (
  <div className="space-y-3 rounded-lg border border-border p-4">
    <Field label="Model">
      <Input value={model} onChange={e => onModelChange(e.target.value)} placeholder={modelPlaceholder} />
    </Field>
    {baseUrl !== undefined && onBaseUrlChange && (
      <Field label="Base URL">
        <Input value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} placeholder="https://api.openai.com/v1" />
      </Field>
    )}
    <Field label="API key" badge={hasKey ? <KeyBadge /> : null}>
      <KeyInput value={apiKey} onChange={onApiKeyChange} show={showKey} onToggleShow={onToggleKey} placeholder={keyPlaceholder} />
    </Field>
  </div>
)
