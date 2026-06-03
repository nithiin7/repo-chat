"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Share2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { fetchDepGraph } from "@/lib/api/depmap";
import { queryKeys } from "@/lib/api/queryKeys";
import type { DepEdge, Repo } from "@/types";

// ---------------------------------------------------------------------------
// Force simulation (Fruchterman–Reingold)
// ---------------------------------------------------------------------------

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function runSimulation(
  ids: string[],
  edges: DepEdge[],
  iterations = 120
): Map<string, { x: number; y: number }> {
  const n = ids.length;
  if (n === 0) return new Map();

  // Initialize on a circle so connected nodes start near each other
  const nodes: SimNode[] = ids.map((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.sqrt(n) * 40;
    return { id, x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0 };
  });
  const nodeMap = new Map(nodes.map((nd) => [nd.id, nd]));
  const k = Math.sqrt((900 * 600) / Math.max(n, 1));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = ((iterations - iter) / iterations) * k * 1.5;
    for (const nd of nodes) {
      nd.vx = 0;
      nd.vy = 0;
    }

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force,
          fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const s = nodeMap.get(e.source),
        t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const dx = t.x - s.x,
        dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force,
        fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    // Weak gravity toward center
    for (const nd of nodes) {
      nd.vx -= nd.x * 0.04;
      nd.vy -= nd.y * 0.04;
    }

    // Apply displacement, capped by temperature
    for (const nd of nodes) {
      const len = Math.sqrt(nd.vx * nd.vx + nd.vy * nd.vy) || 1;
      const disp = Math.min(len, temp);
      nd.x += (nd.vx / len) * disp;
      nd.y += (nd.vy / len) * disp;
    }
  }

  return new Map(nodes.map((nd) => [nd.id, { x: nd.x, y: nd.y }]));
}

// ---------------------------------------------------------------------------
// Colors by extension
// ---------------------------------------------------------------------------

const EXT_COLOR: Record<string, string> = {
  ".py": "#4f9eff",
  ".ts": "#818cf8",
  ".tsx": "#a78bfa",
  ".js": "#fbbf24",
  ".jsx": "#f59e0b",
  ".go": "#34d399",
  ".java": "#fb923c",
};
const DEFAULT_COLOR = "#94a3b8";

const LEGEND = [
  { ext: ".py", label: "Python", color: EXT_COLOR[".py"] },
  { ext: ".ts", label: "TypeScript", color: EXT_COLOR[".ts"] },
  { ext: ".tsx", label: "TSX", color: EXT_COLOR[".tsx"] },
  { ext: ".js", label: "JavaScript", color: EXT_COLOR[".js"] },
  { ext: ".jsx", label: "JSX", color: EXT_COLOR[".jsx"] },
  { ext: ".go", label: "Go", color: EXT_COLOR[".go"] },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DepMapViewProps {
  repo: Repo | null;
  repoId: string;
}

export default function DepMapView({ repo, repoId }: DepMapViewProps) {
  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.deps(repoId),
    queryFn: () => fetchDepGraph(repoId),
    staleTime: 10 * 60 * 1000,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Run force simulation after data loads
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    setSelected(null);
    const ids = data.nodes.map((n) => n.id);
    const pos = runSimulation(ids, data.edges);
    setPositions(pos);
    // Center the graph in the viewport
    if (svgRef.current) {
      const { width, height } = svgRef.current.getBoundingClientRect();
      setPan({ x: width / 2, y: height / 2 });
    }
  }, [data]);

  // Degree (in + out) for node sizing
  const degree = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const e of data.edges) {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    }
    return m;
  }, [data]);

  // Neighbors of selected node
  const neighbors = useMemo(() => {
    if (!selected || !data) return null;
    const outgoing = new Set<string>();
    const incoming = new Set<string>();
    for (const e of data.edges) {
      if (e.source === selected) outgoing.add(e.target);
      if (e.target === selected) incoming.add(e.source);
    }
    const connected = new Set([...outgoing, ...incoming]);
    return { outgoing, incoming, connected };
  }, [selected, data]);

  // IDs matching search filter
  const matchedIds = useMemo(() => {
    if (!filter || !data) return null;
    const q = filter.toLowerCase();
    return new Set(data.nodes.filter((n) => n.id.toLowerCase().includes(q)).map((n) => n.id));
  }, [filter, data]);

  // ----------- Pan / zoom handlers -----------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const el = e.target as Element;
      if (el.tagName === "circle" || el.tagName === "text") return;
      dragRef.current = { startX: e.clientX, startY: e.clientY, tx: pan.x, ty: pan.y };
      svgRef.current?.setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.tx + dx, y: dragRef.current.ty + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(0.08, Math.min(6, s * factor)));
  }, []);

  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const el = e.target as Element;
    if (el === svgRef.current || el.tagName === "line" || el.tagName === "svg") {
      setSelected(null);
    }
  }, []);

  const displayName =
    repo?.name ||
    repo?.url
      .replace(/^https?:\/\//, "")
      .split("/")
      .slice(1, 3)
      .join("/") ||
    repoId;

  const hasPanel = selected !== null && neighbors !== null;

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="border-border bg-background/90 sticky top-0 z-10 flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href={`/chat/${repoId}`}
            aria-label="Back to chat"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden />
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
            <Share2 className="size-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-semibold">{displayName}</p>
            {data && (
              <p className="text-muted-foreground text-xs">
                {data.nodes.length} files · {data.edges.length} dependencies
              </p>
            )}
          </div>
        </div>
        <ThemeToggle />
      </motion.header>

      {/* Search bar */}
      <div className="border-border bg-background/90 shrink-0 border-b px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Highlight files by name…"
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SVG canvas */}
        <div className="relative flex-1 overflow-hidden">
          {/* Status overlays */}
          {(isFetching || (data && !positions)) && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <p className="border-border bg-card text-muted-foreground rounded-lg border px-4 py-2 text-sm">
                {isFetching ? "Building dependency graph…" : "Running layout…"}
              </p>
            </div>
          )}
          {isError && !isFetching && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-destructive text-sm">Failed to load dependencies.</p>
            </div>
          )}
          {data && data.nodes.length === 0 && !isFetching && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                No import dependencies found in this repo.
              </p>
            </div>
          )}

          {/* Graph */}
          <svg
            ref={svgRef}
            className="size-full cursor-grab select-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            onClick={onSvgClick}
          >
            {data && positions && (
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
                {/* Edges */}
                {data.edges.map((e, i) => {
                  const s = positions.get(e.source);
                  const t = positions.get(e.target);
                  if (!s || !t) return null;
                  const isHighlighted = selected === e.source || selected === e.target;
                  const isDimmed = selected !== null && !isHighlighted;
                  return (
                    <line
                      key={i}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={isHighlighted ? "#818cf8" : "currentColor"}
                      strokeWidth={isHighlighted ? 1.5 / scale : 0.6 / scale}
                      strokeOpacity={isDimmed ? 0.05 : isHighlighted ? 0.7 : 0.25}
                    />
                  );
                })}
                {/* Nodes */}
                {data.nodes.map((n) => {
                  const pos = positions.get(n.id);
                  if (!pos) return null;
                  const deg = degree.get(n.id) ?? 0;
                  const r = (3 + Math.sqrt(deg) * 1.8) / scale;
                  const color = EXT_COLOR[n.ext] ?? DEFAULT_COLOR;
                  const isSelected = selected === n.id;
                  const isNeighbor = neighbors?.connected.has(n.id) ?? false;
                  const isMatched = matchedIds?.has(n.id) ?? false;
                  const hasDimCause =
                    (selected !== null && !isSelected && !isNeighbor) ||
                    (matchedIds !== null && !isMatched);
                  const showLabel = deg > 4 || isSelected || isNeighbor || isMatched;

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(n.id === selected ? null : n.id);
                      }}
                    >
                      <circle
                        r={r}
                        fill={color}
                        fillOpacity={hasDimCause ? 0.15 : 0.85}
                        stroke={isSelected ? "#fff" : isNeighbor ? color : "transparent"}
                        strokeWidth={isSelected ? 2 / scale : 1.5 / scale}
                      />
                      {showLabel && (
                        <text
                          dx={r + 3 / scale}
                          dy="0.35em"
                          fontSize={10 / scale}
                          fill="currentColor"
                          fillOpacity={hasDimCause ? 0.15 : 0.65}
                          style={{ pointerEvents: "none" }}
                        >
                          {n.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Legend */}
          {data && positions && (
            <div className="border-border bg-card/80 absolute bottom-4 left-4 flex flex-col gap-1 rounded-xl border p-3 backdrop-blur-md">
              {LEGEND.filter((l) => data.nodes.some((n) => n.ext === l.ext)).map((l) => (
                <div key={l.ext} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-muted-foreground font-mono text-[10px]">{l.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Zoom hint */}
          {data && positions && (
            <div className="text-muted-foreground/50 absolute right-4 bottom-4 text-[10px] select-none">
              Scroll to zoom · drag to pan
            </div>
          )}
        </div>

        {/* Selected node panel */}
        {hasPanel && (
          <motion.aside
            key={selected}
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="border-border bg-card w-72 shrink-0 overflow-y-auto border-l"
          >
            <div className="border-border flex items-start justify-between gap-2 border-b p-4">
              <p className="text-foreground min-w-0 font-mono text-xs font-medium break-all">
                {selected}
              </p>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="space-y-5 p-4">
              {neighbors!.outgoing.size > 0 && (
                <section>
                  <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
                    Imports ({neighbors!.outgoing.size})
                  </p>
                  <ul className="space-y-1">
                    {[...neighbors!.outgoing].sort().map((id) => (
                      <li key={id}>
                        <button
                          onClick={() => setSelected(id)}
                          className={cn(
                            "w-full truncate text-left font-mono text-xs transition-colors",
                            "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {id}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {neighbors!.incoming.size > 0 && (
                <section>
                  <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wide uppercase">
                    Imported by ({neighbors!.incoming.size})
                  </p>
                  <ul className="space-y-1">
                    {[...neighbors!.incoming].sort().map((id) => (
                      <li key={id}>
                        <button
                          onClick={() => setSelected(id)}
                          className={cn(
                            "w-full truncate text-left font-mono text-xs transition-colors",
                            "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {id}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {neighbors!.outgoing.size === 0 && neighbors!.incoming.size === 0 && (
                <p className="text-muted-foreground text-xs">No connections found.</p>
              )}
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}
