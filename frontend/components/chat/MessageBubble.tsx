"use client";

import { memo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  Coins,
  Copy,
  GitBranch,
  Loader2,
  User,
  Files,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { cn } from "@/lib/utils";
import SourceDrawer from "./SourceDrawer";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  repoUrl?: string;
  onSuggestionClick?: (question: string) => void;
  onFork?: (messageId: string) => Promise<void>;
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    const text = preRef.current?.innerText ?? "";
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative">
      <pre ref={preRef}>{children}</pre>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        className={cn(
          "absolute top-2 right-2 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all duration-150",
          copied
            ? "bg-emerald-500/15 text-emerald-400"
            : "border-border bg-card text-muted-foreground hover:text-foreground border opacity-0 group-hover/code:opacity-100"
        )}
      >
        {copied ? (
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
  );
}

const MessageBubble = ({ message, repoUrl, onSuggestionClick, onFork }: MessageBubbleProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [forking, setForking] = useState(false);
  const isUser = message.role === "user";
  const hasSources = !message.streaming && (message.sources?.length ?? 0) > 0;
  const hasSuggestions =
    !message.streaming && !message.error && (message.suggestions?.length ?? 0) > 0;
  const loadingSuggestions = !message.streaming && !message.error && message.suggestionsLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn("mb-6 flex gap-3", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-indigo-500/20 text-indigo-500" : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Bubble + actions */}
      <div className={cn("flex max-w-[82%] flex-col gap-1.5", isUser && "items-end")}>
        {isUser ? (
          <div className="group/user relative">
            <div className="text-foreground rounded-2xl rounded-tr-sm bg-indigo-500/20 px-4 py-2.5 text-sm leading-relaxed ring-1 ring-indigo-500/20">
              {message.content}
            </div>
            {onFork && !message.streaming && (
              <button
                onClick={async () => {
                  if (forking) return;
                  setForking(true);
                  try {
                    await onFork(message.id);
                  } finally {
                    setForking(false);
                  }
                }}
                aria-label="Fork conversation from here"
                title="Fork from here"
                className="text-muted-foreground absolute top-1/2 -left-7 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity group-hover/user:opacity-100 hover:text-indigo-400"
              >
                {forking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <GitBranch className="size-3.5" />
                )}
              </button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed",
              message.error
                ? "border border-red-500/20 bg-red-500/5 text-red-400"
                : "bg-card text-foreground ring-1 ring-white/5"
            )}
          >
            {message.error && (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-400">
                <AlertCircle className="size-3.5" />
                Error
              </div>
            )}

            {/* Content or loading dots */}
            {!message.content && message.streaming ? (
              <div className="flex items-center gap-1 py-1">
                <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                <span className="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
              </div>
            ) : (
              <div className="prose prose-sm prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-strong:font-semibold prose-code:text-indigo-300 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 prose-ol:text-foreground prose-ul:text-foreground prose-li:text-foreground prose-li:marker:text-muted-foreground prose-blockquote:border-indigo-500/40 prose-blockquote:text-muted-foreground prose-hr:border-border max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{ pre: ({ children }) => <CodeBlock>{children}</CodeBlock> }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.streaming && (
                  <span className="-mb-px ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-indigo-400 align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Token usage / cost (cloud mode only) */}
        {!isUser && !message.streaming && message.usage && (
          <div className="text-muted-foreground/50 flex items-center gap-1 px-0.5 text-[10px]">
            <Coins className="size-2.5 shrink-0" />
            {message.usage.cost_usd != null && (
              <span>
                ~${message.usage.cost_usd < 0.0001 ? "0.0000" : message.usage.cost_usd.toFixed(4)}
              </span>
            )}
            {message.usage.cost_usd != null && <span>·</span>}
            <span>
              {message.usage.input_tokens.toLocaleString()} in /{" "}
              {message.usage.output_tokens.toLocaleString()} out
            </span>
          </div>
        )}

        {/* View Sources button */}
        {hasSources && (
          <>
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-muted-foreground hover:bg-muted flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs transition-colors hover:text-indigo-500"
            >
              <Files className="size-3.5" />
              View {message.sources!.length} source{message.sources!.length !== 1 ? "s" : ""}
            </button>

            <SourceDrawer
              sources={message.sources!}
              repoUrl={repoUrl}
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
            />
          </>
        )}

        {/* Suggestion loading skeleton */}
        {loadingSuggestions && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[72, 96, 80].map((w) => (
              <div
                key={w}
                style={{ width: w }}
                className="bg-muted/60 h-7 animate-pulse rounded-lg"
              />
            ))}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {hasSuggestions && onSuggestionClick && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {message.suggestions!.map((q) => (
              <button
                key={q}
                onClick={() => onSuggestionClick(q)}
                className="border-border bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground cursor-pointer rounded-lg border px-3 py-1.5 text-left text-xs transition-[border-color,background-color,color] duration-150 hover:border-indigo-500/30"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default memo(MessageBubble);
