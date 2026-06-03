"use client";

import { useState } from "react";
import { Files, FileCode, Copy, Check, ExternalLink, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SourceChunk } from "@/types";

interface SourceDrawerProps {
  sources: SourceChunk[];
  repoUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildFileUrl(repoUrl: string, filePath: string): string | null {
  try {
    const base = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
    const { hostname, pathname } = new URL(base);

    const repoName = pathname.split("/").filter(Boolean).pop() ?? "";
    const marker = `/${repoName}/`;
    const idx = filePath.indexOf(marker);
    const relative = idx >= 0 ? filePath.slice(idx + marker.length) : filePath.replace(/^\//, "");

    if (hostname === "github.com") return `${base}/blob/HEAD/${relative}`;
    if (hostname === "bitbucket.org") return `${base}/src/HEAD/${relative}`;
    if (hostname.includes("gitlab")) return `${base}/-/blob/HEAD/${relative}`;
    return null;
  } catch {
    return null;
  }
}

const scoreLabel = (score: number) => {
  const pct = Math.round(score * 100);
  const color =
    pct >= 85
      ? "bg-emerald-500/15 text-emerald-400"
      : pct >= 70
        ? "bg-amber-500/15 text-amber-400"
        : pct >= 50
          ? "bg-orange-500/15 text-orange-400"
          : "bg-red-500/15 text-red-400";
  return { pct, color };
};

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".cpp": "cpp",
  ".c": "c",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".html": "xml",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".sh": "bash",
  ".sql": "sql",
  ".kt": "kotlin",
  ".swift": "swift",
  ".scala": "scala",
};

function getLanguage(filePath: string): string {
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx === -1) return "plaintext";
  return EXT_TO_LANG[filePath.slice(dotIdx)] ?? "plaintext";
}

function highlightCode(code: string, language: string): string {
  try {
    if (language === "plaintext") return hljs.highlightAuto(code).value;
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return hljs.highlightAuto(code).value;
  }
}

const slide = {
  list: {
    initial: { x: -24, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -24, opacity: 0 },
  },
  viewer: {
    initial: { x: 24, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 24, opacity: 0 },
  },
};

const transition = { duration: 0.18, ease: "easeInOut" as const };

const SourceDrawer = ({ sources, repoUrl, open, onOpenChange }: SourceDrawerProps) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setExpandedIdx(null);
    onOpenChange(o);
  };

  // Bounds-check: sources array could shrink if the drawer re-renders with new props
  const src = expandedIdx !== null && expandedIdx < sources.length ? sources[expandedIdx] : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="border-border bg-background text-foreground flex flex-col overflow-hidden p-0 data-[side=right]:sm:max-w-xl"
      >
        <AnimatePresence mode="wait" initial={false}>
          {src !== null && expandedIdx !== null ? (
            // ── File viewer ────────────────────────────────────────────────
            <motion.div
              key="viewer"
              {...slide.viewer}
              transition={transition}
              className="flex h-full flex-col"
            >
              {(() => {
                const segments = src.file_path.split("/");
                const filename = segments.pop() ?? src.file_path;
                const dir = segments.length > 0 ? segments.join("/") + "/" : "";
                const language = getLanguage(src.file_path);
                const highlighted = highlightCode(src.chunk, language);
                const lineCount = src.chunk.split("\n").length;
                const fileUrl = repoUrl ? buildFileUrl(repoUrl, src.file_path) : null;
                const { pct, color } = scoreLabel(src.score);

                return (
                  <>
                    <SheetHeader className="border-border shrink-0 space-y-0 border-b px-4 py-3 pr-12">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedIdx(null)}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                        >
                          <ChevronLeft className="size-3.5" />
                          Sources
                        </button>
                        <div className="bg-border h-3.5 w-px" />
                        <div className="flex min-w-0 items-center gap-1.5">
                          <FileCode className="text-muted-foreground size-3.5 shrink-0" />
                          <SheetTitle className="min-w-0 truncate font-mono text-xs font-normal">
                            {dir && <span className="text-muted-foreground">{dir}</span>}
                            <span className="text-foreground font-semibold">{filename}</span>
                          </SheetTitle>
                        </div>
                      </div>
                      <SheetDescription className="flex items-center gap-2 pt-2 pl-1">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                            color
                          )}
                        >
                          {pct}%
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {lineCount} {lineCount === 1 ? "line" : "lines"} · {language}
                        </span>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:bg-muted ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:text-indigo-400"
                          >
                            <ExternalLink className="size-3" />
                            Open in repo
                          </a>
                        )}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-auto">
                      <div className="flex min-w-max font-mono text-xs leading-5">
                        <div className="sticky left-0 min-w-14 bg-[#0d1117] px-3 py-4 text-right text-[#6e7681] select-none">
                          {Array.from({ length: lineCount }, (_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                        {/* Safe: hljs.highlight() escapes all HTML entities before returning */}
                        <pre className="hljs flex-1 py-4 pr-8 pl-4">
                          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                        </pre>
                      </div>
                    </div>

                    <div className="border-border shrink-0 border-t px-4 py-3">
                      <button
                        onClick={() => copy(src.chunk, expandedIdx)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                          copiedIdx === expandedIdx
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        {copiedIdx === expandedIdx ? (
                          <>
                            <Check className="size-3.5" />
                            Copied to clipboard
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            Copy code
                          </>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          ) : (
            // ── Source list ────────────────────────────────────────────────
            <motion.div
              key="list"
              {...slide.list}
              transition={transition}
              className="flex h-full flex-col"
            >
              <SheetHeader className="border-border shrink-0 border-b px-5 py-4 pr-12">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Files className="size-4" />
                  </div>
                  <div>
                    <SheetTitle className="text-foreground text-sm font-semibold">
                      Sources
                    </SheetTitle>
                    <SheetDescription className="text-muted-foreground text-xs">
                      {sources.length} file{sources.length !== 1 ? "s" : ""} referenced in this
                      answer
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-4">
                  {sources.map((s, i) => {
                    const segments = s.file_path.split("/");
                    const filename = segments.pop() ?? s.file_path;
                    const dir = segments.length > 0 ? segments.join("/") + "/" : "";
                    const { pct, color } = scoreLabel(s.score);
                    const fileUrl = repoUrl ? buildFileUrl(repoUrl, s.file_path) : null;

                    return (
                      <div
                        key={i}
                        className="group border-border bg-card overflow-hidden rounded-xl border transition-colors hover:border-indigo-500/40"
                      >
                        <button
                          onClick={() => setExpandedIdx(i)}
                          className="border-border bg-muted/50 hover:bg-muted/80 flex w-full cursor-pointer items-center justify-between gap-3 border-b px-4 py-2.5 text-left transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileCode className="text-muted-foreground size-3.5 shrink-0" />
                            <span className="min-w-0 truncate font-mono text-xs">
                              {dir && <span className="text-muted-foreground">{dir}</span>}
                              <span className="text-foreground font-medium">{filename}</span>
                            </span>
                            {s.repo_name && (
                              <span className="shrink-0 rounded-full bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-indigo-400">
                                {s.repo_name}
                              </span>
                            )}
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                              color
                            )}
                          >
                            {pct}%
                          </span>
                        </button>

                        <div className="relative">
                          <pre className="text-foreground/80 max-h-60 overflow-auto p-4 text-xs leading-relaxed">
                            <code className="font-mono">{s.chunk}</code>
                          </pre>

                          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {fileUrl && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="border-border bg-card text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors hover:text-indigo-400"
                              >
                                <ExternalLink className="size-3" />
                                Open
                              </a>
                            )}
                            <button
                              onClick={() => copy(s.chunk, i)}
                              className={cn(
                                "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
                                copiedIdx === i
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "border-border bg-card text-muted-foreground hover:text-foreground border"
                              )}
                            >
                              {copiedIdx === i ? (
                                <>
                                  <Check className="size-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
};

export default SourceDrawer;
