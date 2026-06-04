"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  GitFork,
  MessageSquare,
  Trash2,
  Loader2,
  FileCode2,
  Clock,
  RefreshCw,
  Search,
  ListTree,
  Share2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { checkRepoStatus, deleteRepo, indexRepo, syncRepo } from "@/lib/api/repos";
import { queryKeys } from "@/lib/api/queryKeys";
import { cn } from "@/lib/utils";
import type { Repo } from "@/types";

const RepoCard = ({
  repo,
  index = 0,
  selected = false,
  onToggleSelect,
}: {
  repo: Repo;
  index?: number;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const displayName =
    repo.name ||
    repo.url
      .replace(/^https?:\/\//, "")
      .split("/")
      .slice(1, 3)
      .join("/");
  const indexedAt = new Date(repo.indexed_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const { data: status } = useQuery({
    queryKey: queryKeys.repoStatus(repo.repo_id),
    queryFn: () => checkRepoStatus(repo.repo_id),
    staleTime: 60 * 1000,
    retry: false,
  });
  const hasUpdates = status?.has_updates ?? false;

  const { mutate: handleDelete, isPending: deleting } = useMutation({
    mutationFn: () => deleteRepo(repo.repo_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.repos() }),
  });

  const { mutate: handleReindex, isPending: reindexing } = useMutation({
    mutationFn: () => indexRepo({ repo_url: repo.url, force: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus(repo.repo_id) });
    },
  });

  const { mutate: handleSync, isPending: syncing } = useMutation({
    mutationFn: () => syncRepo(repo.repo_id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.repos() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus(repo.repo_id) });
    },
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "group border-border bg-card relative flex flex-col gap-4 rounded-xl border p-5",
        "hover:bg-card/80 transition-[border-color,background-color,box-shadow] duration-200 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5",
        hasUpdates && "border-amber-500/30",
        selected && "border-indigo-500/60 ring-1 ring-indigo-500/30",
        (deleting || reindexing || syncing) && "pointer-events-none opacity-40"
      )}
    >
      {/* Compare checkbox */}
      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(repo.repo_id);
          }}
          aria-label={selected ? "Deselect for comparison" : "Select for comparison"}
          className={cn(
            "absolute top-3 left-3 flex size-5 cursor-pointer items-center justify-center rounded border transition-all duration-150",
            selected
              ? "border-indigo-500 bg-indigo-500 text-white"
              : "border-border bg-background opacity-30 group-hover:opacity-100"
          )}
        >
          {selected && (
            <svg
              className="size-3 stroke-current"
              viewBox="0 0 12 12"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>
      )}

      {/* Action buttons — visible on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={() => handleReindex()}
          disabled={reindexing}
          aria-label="Re-index repository"
          className={cn(
            "text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-150",
            hasUpdates
              ? "text-amber-400 opacity-100 hover:bg-amber-500/10"
              : "hover:bg-muted hover:text-foreground"
          )}
        >
          <RefreshCw className={cn("size-3.5", reindexing && "animate-spin")} />
        </button>
        <button
          onClick={() => handleDelete()}
          disabled={deleting}
          aria-label="Delete repository"
          className="text-muted-foreground cursor-pointer rounded-md p-1.5 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            hasUpdates ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
          )}
        >
          <GitFork className="size-4" />
        </div>
        <div className="min-w-0 flex-1 pr-16">
          <h3 className="text-foreground truncate font-semibold">{displayName}</h3>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{repo.url}</p>
        </div>
      </div>

      {/* Updates badge */}
      <AnimatePresence initial={false}>
        {hasUpdates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400">
              <RefreshCw className="size-3" />
              New commits available — sync to update
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <FileCode2 className="size-3.5" />
          {repo.file_count.toLocaleString()} files
        </span>
        <span className="opacity-30">·</span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {indexedAt}
        </span>
        {repo.branch && (
          <>
            <span className="opacity-30">·</span>
            <span className="flex items-center gap-1 font-mono text-indigo-400">
              <GitBranch className="size-3.5" />
              {repo.branch}
            </span>
          </>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto flex items-center justify-between gap-3">
        {/* Secondary feature links */}
        <div className="flex items-center gap-0.5">
          <Tip label="Semantic search" side="top" delay={300}>
            <button
              onClick={() => router.push(`/search/${repo.repo_id}`)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1.5 transition-colors"
            >
              <Search className="size-3.5" />
            </button>
          </Tip>
          <Tip label="Symbol navigator" side="top" delay={300}>
            <button
              onClick={() => router.push(`/navigate/${repo.repo_id}`)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1.5 transition-colors"
            >
              <ListTree className="size-3.5" />
            </button>
          </Tip>
          <Tip label="Dependency map" side="top" delay={300}>
            <button
              onClick={() => router.push(`/depmap/${repo.repo_id}`)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md p-1.5 transition-colors"
            >
              <Share2 className="size-3.5" />
            </button>
          </Tip>
        </div>

        {/* Primary action(s) */}
        <AnimatePresence mode="wait" initial={false}>
          {hasUpdates ? (
            <motion.div
              key="sync"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center gap-2"
            >
              <Button
                onClick={() => handleSync()}
                disabled={syncing}
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                {syncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {syncing ? "Syncing…" : "Sync"}
              </Button>
              <Button
                onClick={() => router.push(`/chat/${repo.repo_id}`)}
                size="sm"
                className="gap-1.5"
              >
                <MessageSquare className="size-3.5" />
                Chat
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <Button
                onClick={() => router.push(`/chat/${repo.repo_id}`)}
                size="sm"
                className="gap-1.5"
              >
                <MessageSquare className="size-3.5" />
                Open Chat
                <ArrowRight className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};

export default RepoCard;
