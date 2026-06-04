"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, GitPullRequest, Loader2, Lock, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import { indexDiff } from "@/lib/api/diffs";
import type { DiffIndexResponse } from "@/types";

interface DiffPanelProps {
  repoId: string;
  activeDiff: DiffIndexResponse | null;
  onDiffLoaded: (diff: DiffIndexResponse) => void;
  onDiffCleared: () => void;
}

const DiffPanel = ({ repoId, activeDiff, onDiffLoaded, onDiffCleared }: DiffPanelProps) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await indexDiff(repoId, {
        source_url: trimmed,
        github_token: token.trim() || undefined,
      });
      onDiffLoaded(result);
      setUrl("");
      setToken("");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load diff";
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.detail ?? msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDiffCleared();
    setOpen(false);
  };

  return (
    <div ref={panelRef} className="relative">
      {activeDiff ? (
        <button
          onClick={() => setOpen((o) => !o)}
          title={activeDiff.title}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
          )}
        >
          <GitPullRequest className="size-3.5 shrink-0" />
          <span className="max-w-30 truncate">
            {activeDiff.title.replace(/^(PR #\d+|Commit [0-9a-f]+):\s*/i, "")}
          </span>
          <span
            role="button"
            onClick={handleClear}
            className="ml-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-indigo-400/20"
          >
            <X className="size-3" />
          </span>
        </button>
      ) : (
        <Tip label="Analyze PR / commit" side="bottom">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Analyze PR or commit"
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
              open
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <GitPullRequest className="size-4" />
          </button>
        </Tip>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="border-border bg-popover absolute top-10 right-0 z-30 w-80 overflow-hidden rounded-xl border shadow-xl"
          >
            <div className="border-border border-b px-4 py-3">
              <p className="text-foreground text-sm font-semibold">Analyze PR / Commit</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Paste a GitHub/Bitbucket PR URL or a commit SHA to add it as context.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2 p-3">
              <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <GitPullRequest className="text-muted-foreground size-3.5 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder="github.com/owner/repo/pull/42 or SHA"
                  disabled={loading}
                  spellCheck={false}
                  autoComplete="off"
                  className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent font-mono text-xs outline-none disabled:opacity-60"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 pl-0.5 text-xs transition-colors"
              >
                <Lock className="size-3" />
                {showToken ? "Hide token" : "Private repo? Add GitHub token"}
              </button>

              <AnimatePresence>
                {showToken && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden"
                  >
                    <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                      <Lock className="text-muted-foreground size-3.5 shrink-0" />
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="GitHub personal access token"
                        disabled={loading}
                        autoComplete="off"
                        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-60"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!url.trim() || loading}
                className="bg-primary text-primary-foreground flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Fetching diff…
                  </>
                ) : (
                  "Load Diff"
                )}
              </button>

              {activeDiff && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="border-border text-muted-foreground hover:text-foreground w-full cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors"
                >
                  Clear active diff
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DiffPanel;
