"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Link2,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { indexRepoStream } from "@/lib/api/repos";
import { queryKeys } from "@/lib/api/queryKeys";
import { cn } from "@/lib/utils";

type Status = "idle" | "indexing" | "success" | "error";

type Progress =
  | { phase: "cloning" }
  | { phase: "loading"; current: number; total: number; filename: string }
  | { phase: "embedding" };

const RepoInput = () => {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [branch, setBranch] = useState("");
  const [showBranch, setShowBranch] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    sub?: string;
    variant: "success" | "error";
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || status === "indexing") return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStatus("indexing");
    setFeedback(null);
    setProgress({ phase: "cloning" });

    try {
      const trimmedBranch = branch.trim() || undefined;
      const stream = indexRepoStream(
        {
          repo_url: trimmed,
          github_token: token.trim() || undefined,
          branch: trimmedBranch,
          // force re-index when a specific branch is given
          force: trimmedBranch ? true : undefined,
        },
        abort.signal
      );

      let fileCount = 0;

      for await (const event of stream) {
        if (event.type === "cloning") {
          setProgress({ phase: "cloning" });
        } else if (event.type === "files_found") {
          setProgress({ phase: "loading", current: 0, total: event.total, filename: "" });
        } else if (event.type === "file") {
          fileCount = event.total;
          setProgress({
            phase: "loading",
            current: event.current,
            total: event.total,
            filename: event.name,
          });
          // After all files loaded, show embedding phase
          if (event.current === event.total) {
            setProgress({ phase: "embedding" });
          }
        } else if (event.type === "done") {
          const count = event.file_count ?? fileCount;
          setUrl("");
          setStatus("success");
          setProgress(null);
          setFeedback({
            message: `Successfully indexed ${count.toLocaleString()} files`,
            sub: "Your repository is ready — open a chat below",
            variant: "success",
          });
          void queryClient.invalidateQueries({ queryKey: queryKeys.repos() });
          setTimeout(() => {
            setStatus("idle");
            setFeedback(null);
          }, 5000);
          return;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStatus("error");
      setProgress(null);
      setFeedback({
        message: err instanceof Error ? err.message : "Failed to index repository",
        sub: "Check the URL is correct. For private repos, add a GitHub token above.",
        variant: "error",
      });
      setTimeout(() => {
        setStatus("idle");
        setFeedback(null);
        inputRef.current?.focus();
      }, 6000);
    }
  };

  const borderColor = {
    idle: "border-border focus-within:border-primary/60",
    indexing: "border-primary/50",
    success: "border-emerald-500/60",
    error: "border-red-500/60",
  }[status];

  const progressPercent =
    progress?.phase === "loading" && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "bg-card flex items-center gap-2 rounded-xl border-2 p-1.5 transition-all duration-300",
            borderColor
          )}
        >
          <div className="flex flex-1 items-center gap-2.5 pl-3">
            <Link2 className="text-muted-foreground size-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo or bitbucket.org/…"
              disabled={status === "indexing"}
              spellCheck={false}
              autoComplete="off"
              className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!url.trim() || status === "indexing"}
            className={cn(
              "shrink-0 gap-2 rounded-lg px-5 font-semibold transition-all duration-200",
              status === "success" && "bg-emerald-600 hover:bg-emerald-600"
            )}
          >
            {status === "indexing" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Indexing…
              </>
            ) : (
              <>
                Index Repo
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>

        {/* Toggles row */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-1">
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
          >
            <Lock className="size-3" />
            {showToken ? "Hide token" : "Private repo? Add a GitHub token"}
          </button>
          <button
            type="button"
            onClick={() => setShowBranch((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              branch.trim()
                ? "text-indigo-400 hover:text-indigo-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitBranch className="size-3" />
            {branch.trim() ? `Branch: ${branch.trim()}` : "Specific branch?"}
          </button>
        </div>

        <AnimatePresence>
          {showToken && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="border-border bg-muted/40 mt-2 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <Lock className="text-muted-foreground size-3.5 shrink-0" />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="GitHub personal access token (repo scope)"
                  disabled={status === "indexing"}
                  autoComplete="off"
                  className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none disabled:opacity-60"
                />
              </div>
              <p className="text-muted-foreground/70 mt-1 pl-1 text-xs">
                Token is sent only for this request and never stored.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showBranch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="border-border bg-muted/40 mt-2 flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <GitBranch className="text-muted-foreground size-3.5 shrink-0" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Branch name (e.g. main, develop, feature/x)"
                  disabled={status === "indexing"}
                  spellCheck={false}
                  autoComplete="off"
                  className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent font-mono text-xs outline-none disabled:opacity-60"
                />
              </div>
              <p className="text-muted-foreground/70 mt-1 pl-1 text-xs">
                Leave blank to use the default branch.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Progress bar / feedback banner */}
      <AnimatePresence mode="wait">
        {progress ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-border bg-muted/30 mt-3 rounded-lg border px-4 py-3">
              {/* Label row */}
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  {progress.phase === "loading" ? (
                    <FileCode2 className="size-3.5 shrink-0" />
                  ) : (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  )}
                  <span className="truncate">
                    {progress.phase === "cloning" && "Cloning repository…"}
                    {progress.phase === "loading" &&
                      (progress.filename ? progress.filename : "Loading files…")}
                    {progress.phase === "embedding" && "Embedding chunks…"}
                  </span>
                </div>
                {progress.phase === "loading" && progress.total > 0 && (
                  <span className="shrink-0 tabular-nums">
                    {progress.current}/{progress.total}
                  </span>
                )}
              </div>

              {/* Progress track */}
              <div className="bg-muted relative mt-2 h-1.5 w-full overflow-hidden rounded-full">
                {progress.phase === "loading" && progressPercent !== null ? (
                  <motion.div
                    className="bg-primary h-full rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                ) : (
                  <motion.div
                    className="bg-primary/70 absolute inset-y-0 w-1/3 rounded-full"
                    animate={{ left: ["-33%", "133%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ) : feedback ? (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mt-3 rounded-lg px-4 py-3 text-sm",
                feedback.variant === "success" &&
                  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                feedback.variant === "error" && "bg-red-500/10 text-red-700 dark:text-red-300"
              )}
            >
              <div className="flex items-center gap-2">
                {feedback.variant === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                <p className="font-medium">{feedback.message}</p>
              </div>
              {feedback.sub && <p className="mt-1 text-left text-xs opacity-75">{feedback.sub}</p>}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default RepoInput;
