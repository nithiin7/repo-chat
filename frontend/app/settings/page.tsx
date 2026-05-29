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

const SettingsPage = () => {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
        setAnthropicModel(s.anthropic_model)
        setOpenaiModel(s.openai_model)
        setOpenaiBaseUrl(s.openai_base_url)
        setGroqModel(s.groq_model)
        setGeminiModel(s.gemini_model)
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

                  {cloudProvider === 'anthropic' && (
                    <ProviderFields
                      model={anthropicModel} onModelChange={setAnthropicModel} modelPlaceholder="claude-sonnet-4-6"
                      apiKey={anthropicKey} onApiKeyChange={setAnthropicKey}
                      showKey={showAnthropicKey} onToggleKey={() => setShowAnthropicKey(v => !v)}
                      keyPlaceholder={settings?.has_anthropic_key ? '••••••••  (leave blank to keep)' : 'sk-ant-…'}
                      hasKey={!!settings?.has_anthropic_key}
                    />
                  )}
                  {cloudProvider === 'openai' && (
                    <ProviderFields
                      model={openaiModel} onModelChange={setOpenaiModel} modelPlaceholder="gpt-4o"
                      baseUrl={openaiBaseUrl} onBaseUrlChange={setOpenaiBaseUrl}
                      apiKey={openaiKey} onApiKeyChange={setOpenaiKey}
                      showKey={showOpenaiKey} onToggleKey={() => setShowOpenaiKey(v => !v)}
                      keyPlaceholder={settings?.has_openai_key ? '••••••••  (leave blank to keep)' : 'sk-…'}
                      hasKey={!!settings?.has_openai_key}
                    />
                  )}
                  {cloudProvider === 'groq' && (
                    <ProviderFields
                      model={groqModel} onModelChange={setGroqModel} modelPlaceholder="llama-3.3-70b-versatile"
                      apiKey={groqKey} onApiKeyChange={setGroqKey}
                      showKey={showGroqKey} onToggleKey={() => setShowGroqKey(v => !v)}
                      keyPlaceholder={settings?.has_groq_key ? '••••••••  (leave blank to keep)' : 'gsk_…'}
                      hasKey={!!settings?.has_groq_key}
                    />
                  )}
                  {cloudProvider === 'gemini' && (
                    <ProviderFields
                      model={geminiModel} onModelChange={setGeminiModel} modelPlaceholder="gemini-2.0-flash"
                      apiKey={geminiKey} onApiKeyChange={setGeminiKey}
                      showKey={showGeminiKey} onToggleKey={() => setShowGeminiKey(v => !v)}
                      keyPlaceholder={settings?.has_gemini_key ? '••••••••  (leave blank to keep)' : 'AIza…'}
                      hasKey={!!settings?.has_gemini_key}
                    />
                  )}
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
                      <button
                        type="button"
                        onClick={handlePull}
                        disabled={pullState === 'pulling' || !embeddingModel}
                        title="Download and activate model"
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
                          pullState === 'done'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
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
                      </button>
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


export default SettingsPage
