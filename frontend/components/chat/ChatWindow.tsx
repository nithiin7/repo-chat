"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GitFork,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Search,
  Share2,
  X,
} from "lucide-react";
import DiffPanel from "./DiffPanel";
import ScopeSelector from "./ScopeSelector";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tip } from "@/components/ui/tooltip";
import LLMModeToggle from "./LLMModeToggle";
import ModelPicker from "./ModelPicker";
import MessageBubble from "./MessageBubble";
import ChatSidebar from "./ChatSidebar";
import HealthPanel from "@/components/health/HealthPanel";
import ChatEmptyState from "./ChatEmptyState";
import ChatInput from "@/components/common/ChatInput";
import { chatStream, forkChat, getChatMessages, listChats } from "@/lib/api/chats";
import type { DiffIndexResponse } from "@/types";
import { queryKeys } from "@/lib/api/queryKeys";
import { exportMarkdown, exportPdf } from "@/lib/exportChat";
import type { Chat, ChatMessage, LLMMode, Message, Repo } from "@/types";

function dbMessagesToUi(dbMessages: ChatMessage[]): Message[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    sources: m.sources ?? undefined,
  }));
}

interface NavContext {
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
  signature: string;
  snippet: string;
}

interface ChatWindowProps {
  repo: Repo | null;
  repoId: string;
  chatId: string;
  chats: Chat[];
  initialMessages: ChatMessage[];
  initialQ?: string;
}

const ChatWindow = ({
  repo,
  repoId,
  chatId,
  chats: initialChats,
  initialMessages,
  initialQ,
}: ChatWindowProps) => {
  const queryClient = useQueryClient();

  const [activeChatId, setActiveChatId] = useState(chatId);
  const [messages, setMessages] = useState<Message[]>(() => dbMessagesToUi(initialMessages));
  const [mode, setMode] = useState<LLMMode>("local");
  const [input, setInput] = useState(initialQ ?? "");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [healthOpen, setHealthOpen] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("codelens_nav_context");
      if (raw) {
        sessionStorage.removeItem("codelens_nav_context");
        return JSON.parse(raw) as NavContext;
      }
    } catch {}
    return null;
  });
  const [navSnippetOpen, setNavSnippetOpen] = useState(false);
  const [scopePath, setScopePath] = useState<string | null>(null);

  // Seed chats cache from server-fetched data; ChatSidebar shares this query key
  useQuery({
    queryKey: queryKeys.chats(repoId),
    queryFn: () => listChats(repoId),
    initialData: initialChats,
  });

  const [activeDiff, setActiveDiff] = useState<DiffIndexResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const cancelRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  const displayName =
    repo?.name ||
    repo?.url
      .replace(/^https?:\/\//, "")
      .split("/")
      .slice(1, 3)
      .join("/") ||
    repoId;

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  useEffect(() => {
    if (userScrolledUp.current) return;
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
  };

  const handleSelectChat = useCallback(
    async (chat: Chat) => {
      if (chat.id === activeChatId) return;
      setActiveChatId(chat.id);
      setMessages([]);
      setInput("");
      userScrolledUp.current = false;
      window.history.pushState(null, "", `/chat/${repoId}/${chat.id}`);
      try {
        const msgs = await queryClient.fetchQuery({
          queryKey: queryKeys.chatMessages(chat.id),
          queryFn: () => getChatMessages(chat.id),
          staleTime: 5 * 60 * 1000,
        });
        setMessages(dbMessagesToUi(msgs));
      } catch {
        setMessages([]);
      }
    },
    [activeChatId, repoId, queryClient]
  );

  const submit = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || streaming) return;

      userScrolledUp.current = false;
      setStreaming(true);
      setInput("");

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: q },
        { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true },
      ]);

      // Optimistically update sidebar title on the first message
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (prev = []) =>
        prev.map((c) =>
          c.id === activeChatId && c.title === "New Chat"
            ? { ...c, title: q.slice(0, 60).trimEnd() }
            : c
        )
      );

      const cancel = chatStream(
        {
          repo_id: repoId,
          question: q,
          mode,
          chat_id: activeChatId,
          diff_id: activeDiff?.diff_id,
          scope_paths: scopePath ? [scopePath] : undefined,
        },
        (token) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: last.content + token }];
          });
        },
        (sources) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, sources }];
          });
        },
        (suggestions) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, suggestions, suggestionsLoading: false }];
          });
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, streaming: false, suggestionsLoading: true }];
          });
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: last.content || "Something went wrong. Please try again.",
                streaming: false,
                error: true,
              },
            ];
          });
          setStreaming(false);
          cancelRef.current = null;
        },
        () => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, streaming: false, suggestionsLoading: false }];
          });
          setStreaming(false);
          cancelRef.current = null;
          // Invalidate so next visit to this chat fetches fresh persisted messages
          void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(activeChatId) });
        },
        (usage) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, usage }];
          });
        }
      );

      cancelRef.current = cancel;
    },
    [streaming, mode, repoId, activeChatId, queryClient, activeDiff, scopePath]
  );

  const handleStop = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, streaming: false }];
    });
    setStreaming(false);
  };

  const handleFork = useCallback(
    async (messageId: string) => {
      const newChat = await forkChat(activeChatId, messageId);
      queryClient.setQueryData<Chat[]>(queryKeys.chats(repoId), (prev = []) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      setMessages([]);
      userScrolledUp.current = false;
      window.history.pushState(null, "", `/chat/${repoId}/${newChat.id}`);
      const msgs = await getChatMessages(newChat.id);
      setMessages(dbMessagesToUi(msgs));
    },
    [activeChatId, repoId, queryClient]
  );

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* ── Sticky header ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="border-border bg-background/90 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Tip label="Back to repositories" side="bottom">
            <Link
              href="/dashboard"
              aria-label="Back to repositories"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Tip>

          <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden />

          <Tip label={sidebarOpen ? "Close sidebar" : "Open sidebar"} side="bottom">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeftOpen className="size-4" />
              )}
            </button>
          </Tip>

          <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden />

          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <GitFork className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">{displayName}</p>
            {repo && (
              <p className="text-muted-foreground truncate text-xs">
                {repo.file_count.toLocaleString()} files indexed
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Tip label="Symbol navigator" side="bottom">
            <Link
              href={`/navigate/${repoId}`}
              aria-label="Symbol navigator"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              <ListTree className="size-4" />
            </Link>
          </Tip>
          <Tip label="Search codebase" side="bottom">
            <Link
              href={`/search/${repoId}`}
              aria-label="Search codebase"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              <Search className="size-4" />
            </Link>
          </Tip>
          <Tip label="Dependency map" side="bottom">
            <Link
              href={`/depmap/${repoId}`}
              aria-label="Dependency map"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              <Share2 className="size-4" />
            </Link>
          </Tip>
          <Tip label={healthOpen ? "Close health panel" : "Repo health"} side="bottom">
            <button
              onClick={() => setHealthOpen((o) => !o)}
              aria-label={healthOpen ? "Close health panel" : "Open health panel"}
              className={`hover:bg-muted flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${healthOpen ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Activity className="size-4" />
            </button>
          </Tip>
          <div ref={exportRef} className="relative">
            <Tip label="Export chat" side="bottom">
              <button
                onClick={() => setExportOpen((o) => !o)}
                aria-label="Export chat"
                className={`hover:bg-muted flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${exportOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Download className="size-4" />
              </button>
            </Tip>
            {exportOpen && (
              <div className="border-border bg-popover absolute top-10 right-0 z-20 w-44 overflow-hidden rounded-lg border shadow-lg">
                <button
                  onClick={() => {
                    exportMarkdown(messages, displayName, displayName);
                    setExportOpen(false);
                  }}
                  className="text-foreground hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm"
                >
                  <FileText className="text-muted-foreground size-3.5 shrink-0" />
                  Markdown (.md)
                </button>
                <button
                  onClick={() => {
                    exportPdf(messages, displayName, displayName);
                    setExportOpen(false);
                  }}
                  className="text-foreground hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm"
                >
                  <Printer className="text-muted-foreground size-3.5 shrink-0" />
                  Print / PDF
                </button>
              </div>
            )}
          </div>
          <DiffPanel
            repoId={repoId}
            activeDiff={activeDiff}
            onDiffLoaded={setActiveDiff}
            onDiffCleared={() => setActiveDiff(null)}
          />
          <LLMModeToggle mode={mode} onChange={setMode} disabled={streaming} />
          <ThemeToggle />
        </div>
      </motion.header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="border-border shrink-0 overflow-hidden border-r"
        >
          <div className="h-full w-65">
            <ChatSidebar
              repoId={repoId}
              activeChatId={activeChatId}
              onSelectChat={handleSelectChat}
            />
          </div>
        </motion.aside>

        {/* Main chat column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Navigator context banner */}
          {navContext && (
            <div className="shrink-0 border-b border-violet-500/20 bg-violet-500/5 px-4 py-3">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {/* Title row */}
                    <div className="flex items-center gap-2">
                      <ListTree className="size-3.5 shrink-0 text-violet-400" />
                      <span className="text-[10px] font-semibold tracking-widest text-violet-400 uppercase">
                        From symbol navigator
                      </span>
                    </div>
                    {/* Symbol info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-400">
                        {navContext.kind}
                      </span>
                      <span className="text-foreground font-mono text-sm font-semibold">
                        {navContext.name}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {navContext.file_path.split("/").slice(-2).join("/")}:
                        {navContext.start_line}
                      </span>
                    </div>
                    {/* Expandable snippet */}
                    <button
                      onClick={() => setNavSnippetOpen((v) => !v)}
                      className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 self-start text-[10px]"
                    >
                      {navSnippetOpen ? (
                        <>
                          <ChevronDown className="size-3" />
                          Hide code
                        </>
                      ) : (
                        <>
                          <ChevronRight className="size-3" />
                          Show code
                        </>
                      )}
                    </button>
                    {navSnippetOpen && (
                      <pre className="border-border bg-card text-foreground/80 mt-1 max-h-48 overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
                        <code className="font-mono">{navContext.snippet}</code>
                      </pre>
                    )}
                  </div>
                  {/* Dismiss */}
                  <button
                    onClick={() => {
                      setNavContext(null);
                      setNavSnippetOpen(false);
                    }}
                    aria-label="Dismiss context"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 flex shrink-0 cursor-pointer items-center justify-center rounded p-1"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message list */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <ChatEmptyState repo={repo} mode={mode} onSuggestionClick={submit} />
            ) : (
              <div className="mx-auto max-w-3xl px-4 py-8">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    repoUrl={repo?.url}
                    onSuggestionClick={submit}
                    onFork={handleFork}
                  />
                ))}
              </div>
            )}
            <div className="h-4" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <ChatInput
              input={input}
              onChange={setInput}
              onSubmit={() => submit(input)}
              onStop={handleStop}
              streaming={streaming}
              mode={mode}
              modelPicker={<ModelPicker mode={mode} disabled={streaming} />}
              scopeSelector={
                <ScopeSelector
                  repoId={repoId}
                  scopePath={scopePath}
                  onChange={setScopePath}
                  disabled={streaming}
                />
              }
            />
          </motion.div>
        </div>

        {/* Health panel — right */}
        <motion.aside
          initial={false}
          animate={{ width: healthOpen ? 320 : 0, opacity: healthOpen ? 1 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="border-border shrink-0 overflow-hidden border-l"
        >
          <div className="h-full w-80">
            <HealthPanel repoId={repoId} open={healthOpen} />
          </div>
        </motion.aside>
      </div>
    </div>
  );
};

export default ChatWindow;
