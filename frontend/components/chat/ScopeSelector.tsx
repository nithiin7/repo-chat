"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Folder, FolderOpen, FileCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRepoFiles } from "@/lib/api/repos";

interface ScopeSelectorProps {
  repoId: string;
  scopePath: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
}

function extractFolders(files: string[]): string[] {
  const folders = new Set<string>();
  for (const f of files) {
    const parts = f.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }
  return Array.from(folders).sort();
}

type ScopeItem = { kind: "folder"; path: string } | { kind: "file"; path: string };

export default function ScopeSelector({
  repoId,
  scopePath,
  onChange,
  disabled,
}: ScopeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || files !== null) return;
    getRepoFiles(repoId)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [open, files, repoId]);

  const items = useMemo<ScopeItem[]>(() => {
    if (!files) return [];
    const folders = extractFolders(files);
    const all: ScopeItem[] = [
      ...folders.map((p) => ({ kind: "folder" as const, path: p })),
      ...files.map((p) => ({ kind: "file" as const, path: p })),
    ];
    if (!filter.trim()) return all;
    const q = filter.toLowerCase();
    return all.filter((item) => item.path.toLowerCase().includes(q));
  }, [files, filter]);

  const handleSelect = (path: string) => {
    onChange(path);
    setOpen(false);
    setFilter("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const shortLabel = scopePath ? scopePath.split("/").slice(-1)[0] : "All files";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-label={scopePath ? `Scoped to ${scopePath}` : "Scope to file or folder"}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
          scopePath
            ? "bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        {scopePath ? (
          <FolderOpen className="size-3 shrink-0" />
        ) : (
          <Folder className="size-3 shrink-0" />
        )}
        <span className="max-w-36 truncate">{shortLabel}</span>
        {scopePath && (
          <span
            role="button"
            aria-label="Clear scope"
            onClick={handleClear}
            className="hover:text-foreground ml-0.5 cursor-pointer rounded"
          >
            <X className="size-2.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="border-border bg-popover absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-lg border shadow-lg">
          <div className="border-border border-b px-3 py-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files and folders…"
              className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {files === null ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-xs">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-xs">No matches</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.kind + ":" + item.path}
                  type="button"
                  onClick={() => handleSelect(item.path)}
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                    scopePath === item.path && "bg-indigo-500/10 text-indigo-400"
                  )}
                >
                  {item.kind === "folder" ? (
                    <Folder className="size-3 shrink-0 text-amber-400" />
                  ) : (
                    <FileCode className="text-muted-foreground size-3 shrink-0" />
                  )}
                  <span className="truncate font-mono">{item.path}</span>
                </button>
              ))
            )}
          </div>

          {scopePath && (
            <div className="border-border border-t px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground w-full cursor-pointer rounded-md py-1 text-xs transition-colors"
              >
                Clear scope
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
