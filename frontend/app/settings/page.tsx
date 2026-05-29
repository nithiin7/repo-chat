'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Cpu, Cloud, AlertCircle, RefreshCw, Database, Download, Check } from 'lucide-react'
import { NavBar } from '@/components/ui/nav-bar'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'
import { Section, Field } from '@/components/settings/section'
import { ProviderFields } from '@/components/settings/provider-fields'
import { getSettings, updateSettings, getOllamaModels, getEmbeddingModels, pullEmbeddingModel } from '@/lib/api'
import { SettingsSkeleton } from './loading'
import type { CloudProvider, EmbeddingModel, Settings, SettingsUpdate } from '@/types'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ProviderCfg = { model: string; key: string; baseUrl?: string }

const CLOUD_PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
]

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [ollamaModel, setOllamaModel] = useState('')
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('anthropic')
  const [providerConfig, setProviderConfig] = useState<Record<CloudProvider, ProviderCfg>>({
    anthropic: { model: '', key: '' },
    openai: { model: '', key: '', baseUrl: '' },
    groq: { model: '', key: '' },
    gemini: { model: '', key: '' },
  })
  const [showKey, setShowKey] = useState(false)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([])
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'done' | 'error'>('idle')
  const [pullError, setPullError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [s, models, embedModels] = await Promise.all([getSettings(), getOllamaModels(), getEmbeddingModels()])
        setSettings(s)
        setOllamaModels(models)
        setOllamaModel(s.ollama_model)
        setCloudProvider(s.cloud_provider)
        setProviderConfig({
          anthropic: { model: s.anthropic_model, key: '' },
          openai: { model: s.openai_model, key: '', baseUrl: s.openai_base_url },
          groq: { model: s.groq_model, key: '' },
          gemini: { model: s.gemini_model, key: '' },
        })
        setEmbeddingModels(embedModels)
        setEmbeddingModel(s.embedding_model)
      } catch {
        setLoadError('Could not reach the backend. Make sure it is running.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const setActiveField = (field: keyof ProviderCfg, value: string) =>
    setProviderConfig(c => ({ ...c, [cloudProvider]: { ...c[cloudProvider], [field]: value } }))

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
        anthropic_model: providerConfig.anthropic.model || undefined,
        openai_model: providerConfig.openai.model || undefined,
        openai_base_url: providerConfig.openai.baseUrl || undefined,
        groq_model: providerConfig.groq.model || undefined,
        gemini_model: providerConfig.gemini.model || undefined,
      }
      if (providerConfig.anthropic.key) update.anthropic_api_key = providerConfig.anthropic.key
      if (providerConfig.openai.key) update.openai_api_key = providerConfig.openai.key
      if (providerConfig.groq.key) update.groq_api_key = providerConfig.groq.key
      if (providerConfig.gemini.key) update.gemini_api_key = providerConfig.gemini.key

      const updated = await updateSettings(update)
      setSettings(updated)
      setProviderConfig(c => ({
        ...c,
        anthropic: { ...c.anthropic, key: '' },
        openai: { ...c.openai, key: '' },
        groq: { ...c.groq, key: '' },
        gemini: { ...c.gemini, key: '' },
      }))
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings.')
      setSaveState('error')
    }
  }

  async function handlePull() {
    if (!embeddingModel) return
    setPullState('pulling')
    setPullError(null)
    try {
      await pullEmbeddingModel(embeddingModel)
      setSettings(s => s ? { ...s, embedding_model: embeddingModel } : s)
      setPullState('done')
      setTimeout(() => setPullState('idle'), 3000)
    } catch (err) {
      setPullError(err instanceof Error ? err.message : 'Failed to download model.')
      setPullState('error')
    }
  }

  const providerMeta: Record<CloudProvider, { modelPlaceholder: string; hasKey: boolean; keyPlaceholder: string }> = {
    anthropic: { modelPlaceholder: 'claude-sonnet-4-6', hasKey: !!settings?.has_anthropic_key, keyPlaceholder: settings?.has_anthropic_key ? '••••••••  (leave blank to keep)' : 'sk-ant-…' },
    openai: { modelPlaceholder: 'gpt-4o', hasKey: !!settings?.has_openai_key, keyPlaceholder: settings?.has_openai_key ? '••••••••  (leave blank to keep)' : 'sk-…' },
    groq: { modelPlaceholder: 'llama-3.3-70b-versatile', hasKey: !!settings?.has_groq_key, keyPlaceholder: settings?.has_groq_key ? '••••••••  (leave blank to keep)' : 'gsk_…' },
    gemini: { modelPlaceholder: 'gemini-2.0-flash', hasKey: !!settings?.has_gemini_key, keyPlaceholder: settings?.has_gemini_key ? '••••••••  (leave blank to keep)' : 'AIza…' },
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar hideSettings />

      {/* ── Page header ── */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
          >
            <ArrowLeft className="size-3.5" />
            Dashboard
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
                        <Input
                          value={ollamaModel}
                          onChange={e => setOllamaModel(e.target.value)}
                          placeholder="e.g. llama3.1:8b"
                          className="flex-1"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={refreshOllamaModels}
                        title="Refresh model list"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
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
                  <Field label="Provider">
                    <Dropdown
                      options={CLOUD_PROVIDERS}
                      value={cloudProvider}
                      onChange={v => { setCloudProvider(v as CloudProvider); setShowKey(false) }}
                      className="w-40"
                    />
                  </Field>

                  <ProviderFields
                    model={providerConfig[cloudProvider].model}
                    onModelChange={v => setActiveField('model', v)}
                    modelPlaceholder={providerMeta[cloudProvider].modelPlaceholder}
                    baseUrl={cloudProvider === 'openai' ? (providerConfig.openai.baseUrl ?? '') : undefined}
                    onBaseUrlChange={cloudProvider === 'openai' ? v => setActiveField('baseUrl', v) : undefined}
                    apiKey={providerConfig[cloudProvider].key}
                    onApiKeyChange={v => setActiveField('key', v)}
                    showKey={showKey}
                    onToggleKey={() => setShowKey(v => !v)}
                    keyPlaceholder={providerMeta[cloudProvider].keyPlaceholder}
                    hasKey={providerMeta[cloudProvider].hasKey}
                  />
                </div>
              </Section>
            </div>

            {/* ── Embeddings ── */}
            <div className="mt-6">
              <Section
                icon={<Database className="size-4 text-violet-400" />}
                title="Embeddings"
                description="HuggingFace model used to index and search code. Changing the model requires re-indexing all repos."
              >
                <div className="space-y-4">
                  <Field label="Model">
                    <div className="flex gap-2">
                      {embeddingModels.length > 0 ? (
                        <Dropdown
                          className="flex-1"
                          options={[
                            ...embeddingModels.map(m => ({ value: m.id, label: `${m.name} (${m.size})` })),
                            ...(embeddingModel && !embeddingModels.find(m => m.id === embeddingModel)
                              ? [{ value: embeddingModel, label: embeddingModel }]
                              : []),
                          ]}
                          value={embeddingModel}
                          onChange={setEmbeddingModel}
                        />
                      ) : (
                        <Input
                          value={embeddingModel}
                          onChange={e => setEmbeddingModel(e.target.value)}
                          placeholder="e.g. BAAI/bge-small-en-v1.5"
                          className="flex-1"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={handlePull}
                        disabled={pullState === 'pulling' || !embeddingModel}
                        title="Download and activate model"
                        className={cn(
                          'gap-1.5 px-3',
                          pullState === 'done' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15',
                        )}
                      >
                        {pullState === 'pulling' ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : pullState === 'done' ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                        {pullState === 'pulling' ? 'Downloading…' : pullState === 'done' ? 'Ready' : 'Download & Activate'}
                      </Button>
                    </div>
                    {settings && embeddingModel !== settings.embedding_model && pullState === 'idle' && (
                      <p className="mt-1.5 text-xs text-amber-400">
                        After activating, re-index all repos for the new model to take effect.
                      </p>
                    )}
                    {pullState === 'error' && pullError && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="size-3" />
                        {pullError}
                      </p>
                    )}
                    {settings && embeddingModel === settings.embedding_model && (
                      <p className="mt-1.5 text-xs text-muted-foreground/70">
                        Active model: <span className="font-mono">{settings.embedding_model}</span>
                      </p>
                    )}
                  </Field>
                </div>
              </Section>
            </div>

            {/* ── Save bar ── */}
            <div className="mt-8 flex items-center gap-4 border-t border-border pt-6">
              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className={cn(
                  'bg-indigo-500 px-6 text-white hover:bg-indigo-600',
                  saveState === 'saved' && 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20',
                )}
              >
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save settings'}
              </Button>

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


export default SettingsPage
