'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Cpu, Cloud, Eye, EyeOff, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'
import { Dropdown } from '@/components/ui/dropdown'
import { Skeleton } from '@/components/ui/skeleton'
import { getSettings, updateSettings, getOllamaModels } from '@/lib/api'
import type { CloudProvider, Settings, SettingsUpdate } from '@/types'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Local form state
  const [ollamaModel, setOllamaModel] = useState('')
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('anthropic')
  const [anthropicModel, setAnthropicModel] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [openaiModel, setOpenaiModel] = useState('')
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [groqModel, setGroqModel] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [geminiModel, setGeminiModel] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, models] = await Promise.all([getSettings(), getOllamaModels()])
        setSettings(s)
        setOllamaModels(models)
        setOllamaModel(s.ollama_model)
        setCloudProvider(s.cloud_provider)
        setAnthropicModel(s.anthropic_model)
        setOpenaiModel(s.openai_model)
        setOpenaiBaseUrl(s.openai_base_url)
        setGroqModel(s.groq_model)
        setGeminiModel(s.gemini_model)
      } catch {
        setLoadError('Could not reach the backend. Make sure it is running.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function refreshOllamaModels() {
    const models = await getOllamaModels()
    setOllamaModels(models)
  }

  async function handleSave() {
    setSaveState('saving')
    setSaveError(null)
    try {
      const update: SettingsUpdate = {
        ollama_model: ollamaModel || undefined,
        cloud_provider: cloudProvider,
        anthropic_model: anthropicModel || undefined,
        openai_model: openaiModel || undefined,
        openai_base_url: openaiBaseUrl || undefined,
        groq_model: groqModel || undefined,
        gemini_model: geminiModel || undefined,
      }
      if (anthropicKey) update.anthropic_api_key = anthropicKey
      if (openaiKey) update.openai_api_key = openaiKey
      if (groqKey) update.groq_api_key = groqKey
      if (geminiKey) update.gemini_api_key = geminiKey

      const updated = await updateSettings(update)
      setSettings(updated)
      setAnthropicKey('')
      setOpenaiKey('')
      setGroqKey('')
      setGeminiKey('')
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings.')
      setSaveState('error')
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar hideSettings />

      {/* ── Page header ── */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">Settings</span>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-10 sm:px-6 lg:px-10">
        {loading && <SettingsSkeleton />}

        {loadError && (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {loadError}
            </div>
          </div>
        )}

        {!loading && !loadError && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure LLM models and API keys. Changes take effect on the next chat.
              </p>
            </div>

            {/* ── Two-column grid on lg+, single column on mobile ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8">
              {/* ── Local (Ollama) ── */}
              <Section
                icon={<Cpu className="size-4 text-emerald-400" />}
                title="Local (Ollama)"
                description="Model used when chatting in Local mode. No data leaves your machine."
              >
                <div className="space-y-4">
                  <Field label="Active model">
                    <div className="flex gap-2">
                      {ollamaModels.length > 0 ? (
                        <Dropdown
                          className="flex-1"
                          options={
                            ollamaModel && !ollamaModels.includes(ollamaModel)
                              ? [...ollamaModels, ollamaModel]
                              : ollamaModels
                          }
                          value={ollamaModel}
                          onChange={setOllamaModel}
                        />
                      ) : (
                        <input
                          type="text"
                          value={ollamaModel}
                          onChange={e => setOllamaModel(e.target.value)}
                          placeholder="e.g. llama3.1:8b"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                      <button
                        type="button"
                        onClick={refreshOllamaModels}
                        title="Refresh model list"
                        className="flex items-center justify-center rounded-md border border-border px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                    </div>
                    {ollamaModels.length === 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground/70">
                        Ollama not reachable — type a model name or start Ollama and refresh.
                      </p>
                    )}
                  </Field>
                </div>
              </Section>

              {/* ── Cloud ── */}
              <Section
                icon={<Cloud className="size-4 text-indigo-400" />}
                title="Cloud"
                description="Provider and model used when chatting in Cloud mode."
              >
                <div className="space-y-5">
                  {/* Provider toggle */}
                  <Field label="Provider">
                    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5 self-start flex-wrap">
                      {(['anthropic', 'openai', 'groq', 'gemini'] as CloudProvider[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCloudProvider(p)}
                          className={cn(
                            'rounded-md px-4 py-1.5 text-xs font-medium transition-all duration-150',
                            cloudProvider === p
                              ? 'bg-indigo-500/15 text-indigo-400'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {p === 'anthropic' ? 'Anthropic' : p === 'openai' ? 'OpenAI' : p === 'groq' ? 'Groq' : 'Gemini'}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {/* Anthropic fields */}
                  {cloudProvider === 'anthropic' && (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <Field label="Model">
                        <input
                          type="text"
                          value={anthropicModel}
                          onChange={e => setAnthropicModel(e.target.value)}
                          placeholder="claude-sonnet-4-6"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </Field>
                      <Field label="API key" badge={settings?.has_anthropic_key ? <KeyBadge /> : null}>
                        <KeyInput
                          value={anthropicKey}
                          onChange={setAnthropicKey}
                          show={showAnthropicKey}
                          onToggleShow={() => setShowAnthropicKey(v => !v)}
                          placeholder={settings?.has_anthropic_key ? '••••••••  (leave blank to keep)' : 'sk-ant-…'}
                        />
                      </Field>
                    </div>
                  )}

                  {/* OpenAI fields */}
                  {cloudProvider === 'openai' && (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <Field label="Model">
                        <input
                          type="text"
                          value={openaiModel}
                          onChange={e => setOpenaiModel(e.target.value)}
                          placeholder="gpt-4o"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </Field>
                      <Field label="Base URL">
                        <input
                          type="text"
                          value={openaiBaseUrl}
                          onChange={e => setOpenaiBaseUrl(e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </Field>
                      <Field label="API key" badge={settings?.has_openai_key ? <KeyBadge /> : null}>
                        <KeyInput
                          value={openaiKey}
                          onChange={setOpenaiKey}
                          show={showOpenaiKey}
                          onToggleShow={() => setShowOpenaiKey(v => !v)}
                          placeholder={settings?.has_openai_key ? '••••••••  (leave blank to keep)' : 'sk-…'}
                        />
                      </Field>
                    </div>
                  )}

                  {/* Groq fields */}
                  {cloudProvider === 'groq' && (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <Field label="Model">
                        <input
                          type="text"
                          value={groqModel}
                          onChange={e => setGroqModel(e.target.value)}
                          placeholder="llama-3.3-70b-versatile"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </Field>
                      <Field label="API key" badge={settings?.has_groq_key ? <KeyBadge /> : null}>
                        <KeyInput
                          value={groqKey}
                          onChange={setGroqKey}
                          show={showGroqKey}
                          onToggleShow={() => setShowGroqKey(v => !v)}
                          placeholder={settings?.has_groq_key ? '••••••••  (leave blank to keep)' : 'gsk_…'}
                        />
                      </Field>
                    </div>
                  )}

                  {/* Gemini fields */}
                  {cloudProvider === 'gemini' && (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <Field label="Model">
                        <input
                          type="text"
                          value={geminiModel}
                          onChange={e => setGeminiModel(e.target.value)}
                          placeholder="gemini-2.0-flash"
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </Field>
                      <Field label="API key" badge={settings?.has_gemini_key ? <KeyBadge /> : null}>
                        <KeyInput
                          value={geminiKey}
                          onChange={setGeminiKey}
                          show={showGeminiKey}
                          onToggleShow={() => setShowGeminiKey(v => !v)}
                          placeholder={settings?.has_gemini_key ? '••••••••  (leave blank to keep)' : 'AIza…'}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* ── Save bar ── */}
            <div className="mt-8 flex items-center gap-4 border-t border-border pt-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className={cn(
                  'rounded-lg px-6 py-2.5 text-sm font-medium transition-all',
                  saveState === 'saved'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-60',
                )}
              >
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save settings'}
              </button>

              {saveState === 'error' && saveError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5" />
                  {saveError}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8">
        {/* Local (Ollama) card */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 w-10 rounded-md" />
            </div>
          </div>
        </div>

        {/* Cloud card */}
        <div className="flex flex-col rounded-xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="space-y-5">
            {/* Provider toggle */}
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <div className="flex gap-1 self-start rounded-lg border border-border bg-card p-0.5">
                <Skeleton className="h-7 w-20 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-12 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </div>
            {/* Provider fields */}
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
      </div>

      {/* Save bar */}
      <div className="mt-8 border-t border-border pt-6">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  badge,
  children,
}: {
  label: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {badge}
      </div>
      {children}
    </div>
  )
}

function KeyBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
      <Check className="size-3" />
      Configured
    </span>
  )
}

function KeyInput({
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
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
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
}
