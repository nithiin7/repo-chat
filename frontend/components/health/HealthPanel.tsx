"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Flame, TestTube2 } from "lucide-react";
import { fetchHealthSummary } from "@/lib/api/health";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ComplexityHotspot, TestCoverageEstimate, TodoItem } from "@/types";

const TODO_COLORS: Record<string, string> = {
  FIXME: "text-red-400 bg-red-500/10",
  BUG: "text-red-400 bg-red-500/10",
  HACK: "text-orange-400 bg-orange-500/10",
  TODO: "text-yellow-400 bg-yellow-500/10",
  XXX: "text-orange-400 bg-orange-500/10",
  NOTE: "text-blue-400 bg-blue-500/10",
};

function CoverageBar({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const color = pct >= 40 ? "bg-emerald-500" : pct >= 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CoverageCard({ coverage }: { coverage: TestCoverageEstimate }) {
  const pct = Math.round(coverage.coverage_ratio * 100);
  return (
    <section className="border-border bg-card mb-4 rounded-xl border p-3">
      <div className="mb-2 flex items-center gap-2">
        <TestTube2 className="size-3.5 shrink-0 text-emerald-400" />
        <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          Test Coverage
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-foreground text-2xl font-bold">{pct}%</span>
        <span className="text-muted-foreground text-xs">
          {coverage.test_file_count} test / {coverage.source_file_count + coverage.test_file_count}{" "}
          total files
        </span>
      </div>
      <CoverageBar ratio={coverage.coverage_ratio} />
      <p className="text-muted-foreground mt-2 text-xs">
        {coverage.test_function_count} test functions out of {coverage.total_function_count} total
      </p>
    </section>
  );
}

function HotspotRow({ hotspot }: { hotspot: ComplexityHotspot }) {
  const label = hotspot.file_path.split("/").slice(-2).join("/");
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-xs">
      <span className="text-foreground/80 min-w-0 truncate font-mono" title={hotspot.file_path}>
        {label}
      </span>
      <div className="text-muted-foreground flex shrink-0 items-center gap-2">
        <span>{hotspot.function_count} fn</span>
        <span className="text-border">·</span>
        <span>avg {hotspot.avg_function_length}L</span>
      </div>
    </div>
  );
}

function ComplexityCard({ hotspots }: { hotspots: ComplexityHotspot[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-border bg-card mb-4 rounded-xl border p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Flame className="size-3.5 shrink-0 text-orange-400" />
        <span className="text-muted-foreground flex-1 text-xs font-semibold tracking-widest uppercase">
          Complexity Hotspots
        </span>
        <span className="text-muted-foreground text-xs">{hotspots.length}</span>
        {open ? (
          <ChevronDown className="text-muted-foreground size-3" />
        ) : (
          <ChevronRight className="text-muted-foreground size-3" />
        )}
      </button>
      {open && (
        <div className="divide-border mt-2 divide-y">
          {hotspots.length === 0 ? (
            <p className="text-muted-foreground py-2 text-xs">No symbols indexed yet.</p>
          ) : (
            hotspots.map((h) => <HotspotRow key={h.file_path} hotspot={h} />)
          )}
        </div>
      )}
    </section>
  );
}

function TodoRow({ item }: { item: TodoItem }) {
  const colorClass = TODO_COLORS[item.kind] ?? "text-muted-foreground bg-muted";
  const label = item.file_path.split("/").slice(-2).join("/");
  return (
    <div className="py-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <span className={`rounded px-1 py-0.5 font-mono text-[10px] font-semibold ${colorClass}`}>
          {item.kind}
        </span>
        <span className="text-muted-foreground truncate font-mono" title={item.file_path}>
          {label}:{item.line}
        </span>
      </div>
      {item.text && (
        <p className="text-foreground/80 mt-0.5 truncate pl-0.5" title={item.text}>
          {item.text}
        </p>
      )}
    </div>
  );
}

function TodosCard({ todos }: { todos: TodoItem[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-border bg-card mb-4 rounded-xl border p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <AlertTriangle className="size-3.5 shrink-0 text-yellow-400" />
        <span className="text-muted-foreground flex-1 text-xs font-semibold tracking-widest uppercase">
          TODOs / FIXMEs
        </span>
        <span className="text-muted-foreground text-xs">{todos.length}</span>
        {open ? (
          <ChevronDown className="text-muted-foreground size-3" />
        ) : (
          <ChevronRight className="text-muted-foreground size-3" />
        )}
      </button>
      {open && (
        <div className="divide-border mt-2 divide-y">
          {todos.length === 0 ? (
            <p className="text-muted-foreground py-2 text-xs">No TODO/FIXME comments found.</p>
          ) : (
            todos.map((t, i) => <TodoRow key={i} item={t} />)
          )}
        </div>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[72, 120, 160].map((h) => (
        <div key={h} className={`bg-muted rounded-xl`} style={{ height: h }} />
      ))}
    </div>
  );
}

interface HealthPanelProps {
  repoId: string;
  open: boolean;
}

export default function HealthPanel({ repoId, open }: HealthPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.health(repoId),
    queryFn: () => fetchHealthSummary(repoId),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  if (!open) return null;

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-widest uppercase">
        Repo Health
      </p>
      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <p className="text-destructive text-xs">Failed to load health summary.</p>
      ) : data ? (
        <>
          <CoverageCard coverage={data.test_coverage} />
          <ComplexityCard hotspots={data.complexity_hotspots} />
          <TodosCard todos={data.todos} />
        </>
      ) : null}
    </div>
  );
}
