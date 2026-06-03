"use client";

import { useEffect, useRef } from "react";
import { SendHorizontal, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import type { LLMMode } from "@/types";

interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  mode: LLMMode;
  modelPicker?: React.ReactNode;
  scopeSelector?: React.ReactNode;
}

const ChatInput = ({
  input,
  onChange,
  onSubmit,
  onStop,
  streaming,
  mode,
  modelPicker,
  scopeSelector,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="border-border bg-background/90 shrink-0 border-t px-4 py-4 backdrop-blur-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mx-auto max-w-3xl"
      >
        <div
          className={cn(
            "bg-card flex flex-col rounded-xl border transition-colors duration-150",
            streaming ? "border-border/40" : "border-border focus-within:border-indigo-500/40"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={streaming ? "Responding…" : "Ask about this codebase…"}
            rows={3}
            className="text-foreground placeholder:text-muted-foreground max-h-56 flex-1 resize-none bg-transparent px-4 pt-3 pb-2 text-sm leading-relaxed outline-none disabled:opacity-40"
          />

          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-2">
              {modelPicker}
              {scopeSelector}
            </div>

            {streaming ? (
              <Tip label="Stop generating" side="top">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="border-border bg-background text-foreground hover:bg-muted flex size-8 cursor-pointer items-center justify-center rounded-lg border transition-colors"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              </Tip>
            ) : (
              <Tip label="Send message" side="top">
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-indigo-500 text-white transition-colors hover:bg-indigo-600 disabled:pointer-events-none disabled:opacity-40"
                >
                  <SendHorizontal className="size-3.5" />
                </button>
              </Tip>
            )}
          </div>
        </div>
      </form>

      <p className="text-muted-foreground/50 mt-2 text-center text-[11px]">
        {mode === "local"
          ? "⚡ Local — no data leaves your machine"
          : "☁ Cloud — data sent to LLM API"}
        &nbsp;·&nbsp;Enter to send&nbsp;·&nbsp;Shift+Enter for newline
      </p>
    </div>
  );
};

export default ChatInput;
