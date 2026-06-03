"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label?: string;
}

interface DropdownProps {
  options: DropdownOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const toOption = (o: DropdownOption | string): DropdownOption =>
  typeof o === "string" ? { value: o, label: o } : o;

export const Dropdown = ({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: DropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const normalised = options.map(toOption);
  const selected = normalised.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "border-border bg-background flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
          "hover:bg-muted/50 focus:ring-ring focus:ring-1 focus:outline-none",
          open && "ring-ring ring-1"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground/50")}>
          {selected?.label ?? selected?.value ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Options panel */}
      {open && (
        <div className="border-border bg-card absolute top-full left-0 z-50 mt-1.5 w-full overflow-hidden rounded-md border shadow-lg shadow-black/10">
          <div className="max-h-60 overflow-y-auto py-1">
            {normalised.length === 0 ? (
              <div className="text-muted-foreground px-3 py-2 text-xs">No options</div>
            ) : (
              normalised.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="flex-1 truncate">{option.label ?? option.value}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-indigo-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
