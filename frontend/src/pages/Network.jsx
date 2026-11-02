import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Crosshair, GitBranch, Loader2, Maximize2, Network as NetworkIcon, RefreshCw } from "lucide-react";
import Badge, { RiskBadge } from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import { getGraph } from "../services/api";
import { money, number } from "../services/format";

const NODE_COLORS = {
  individual: "#2dd4bf",
  business: "#34d399",
  shell: "#a3e635",
  external: "#6f8f7f",
};

export default function Network() {
  const { version } = useApp();
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [cyclesOnly, setCyclesOnly] = useState(false);
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const size = useElementSize(containerRef);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getGraph()
      .then((data) => active && setGraph(data))
      .catch(() => active && setGraph(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [version]);

  const data = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    const cycleNodeIds = new Set();
    graph.edges.forEach((edge) => {
      if (edge.in_cycle) {
        cycleNodeIds.add(edge.source);
        cycleNodeIds.add(edge.target);
      }
    });

    const nodes = graph.nodes
      .filter((node) => !cyclesOnly || cycleNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        __cycle: node.in_cycle || cycleNodeIds.has(node.id),
      }));
    const visible = new Set(nodes.map((n) => n.id));
    const links = graph.edges
      .filter((edge) => visible.has(edge.source) && visible.has(edge.target))
      .filter((edge) => !cyclesOnly || edge.in_cycle)
      .map((edge) => ({ ...edge }));

    return { nodes, links };
  }, [graph, cyclesOnly]);

  useEffect(() => {
    if (!graph || !graphRef.current) return;
    const fg = graphRef.current;
    const charge = fg.d3Force("charge");
    if (charge && typeof charge.strength === "function") {
      charge.strength(-145);
    }
    const link = fg.d3Force("link");
    if (link && typeof link.distance === "function") {
      link.distance((edge) => (edge.in_cycle ? 46 : 105));
      link.strength((edge) => (edge.in_cycle ? 0.65 : 0.18));
    }
    fg.d3ReheatSimulation();
    const timer = setTimeout(() => {
      fg.zoomToFit?.(800, 70);
    }, 850);
    return () => clearTimeout(timer);
  }, [graph, cyclesOnly, data]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState
        icon={NetworkIcon}
        title="No network to display"
        message="Generate a ledger and run a detection scan. The account graph will appear here with circular flows highlighted in red."
      />
    );
  }

  const cycleEdges = graph.edges.filter((e) => e.in_cycle);
  const cycleNodes = new Set(cycleEdges.flatMap((e) => [e.source, e.target]));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">NetworkX graph</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Account relationship map</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {number(graph.nodes.length)} accounts · {number(graph.edges.length)} aggregated edges ·{" "}
            {number(graph.cycles.length)} circular flows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`chip transition ${cyclesOnly ? "border-rose-400/40 bg-rose-400/10 text-rose-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => setCyclesOnly((v) => !v)}
          >
            <GitBranch className="h-3.5 w-3.5" /> {cyclesOnly ? "Showing rings" : "Highlight rings"}
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => graphRef.current?.zoomToFit?.(600, 50)}>
            <Maximize2 className="h-3.5 w-3.5" /> Fit view
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setSelected(null)}>
            <Crosshair className="h-3.5 w-3.5" /> Clear selection
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="card relative overflow-hidden">
          <div ref={containerRef} className="h-[620px] w-full">
            <ForceGraph2D
              ref={graphRef}
              graphData={data}
              width={size.width}
              height={size.height}
              backgroundColor="#020604"
              nodeId="id"
              nodeLabel={(node) => `${node.name} · ${node.id} · ${node.account_type}`}
              nodeColor={(node) =>
                node.in_cycle ? "#fb7185" : NODE_COLORS[node.account_type] || "#6f8f7f"
              }
              nodeVal={(node) =>
                Math.max(2.2, Math.min(14, Math.log10(Number(node.volume_in || 0) + Number(node.volume_out || 0) + 10) * 1.8))
              }
              nodeRelSize={4}
              linkColor={(link) =>
                link.in_cycle ? "rgba(251,113,133,0.8)" : "rgba(110,143,126,0.20)"
              }
              linkWidth={(link) => (link.in_cycle ? 1.7 : 0.6)}
              linkDirectionalArrowLength={(link) => (link.in_cycle ? 4 : 2.5)}
              linkDirectionalArrowRelPos={0.9}
              linkDirectionalParticles={(link) => (link.in_cycle ? 2 : 0)}
              linkDirectionalParticleWidth={1.6}
              linkDirectionalParticleColor={() => "#fb7185"}
              onNodeClick={(node) => setSelected(node)}
              cooldownTicks={120}
              warmupTicks={30}
              d3AlphaDecay={0.022}
              d3VelocityDecay={0.3}
            />
          </div>

          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/[0.06] bg-[#06120b]/80 px-3.5 py-3 backdrop-blur">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Legend</p>
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              {[
                ["Individual", NODE_COLORS.individual],
                ["Business", NODE_COLORS.business],
                ["Shell company", NODE_COLORS.shell],
                ["Circular flow", "#fb7185"],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/[0.06] bg-[#06120b]/80 px-3 py-1.5 text-[10px] text-zinc-500 backdrop-blur">
            Click a node to inspect · scroll to zoom · drag to pan
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <div className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="label">Account</p>
                  <h3 className="mt-1 text-base font-bold text-white">{selected.name}</h3>
                  <p className="font-mono text-[11px] text-zinc-500">{selected.id}</p>
                </div>
                <RiskBadge score={selected.risk_score} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge tone={selected.account_type === "shell" ? "violet" : "sky"} className="capitalize">
                  {selected.account_type}
                </Badge>
                {selected.country && <Badge tone="slate">{selected.country}</Badge>}
                {selected.in_cycle && <Badge tone="rose" dot>in circular flow</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <NodeStat label="Transactions" value={number(selected.txn_count)} />
                <NodeStat label="Risk score" value={Number(selected.risk_score || 0).toFixed(2)} />
                <NodeStat label="Volume out" value={money(selected.volume_out)} />
                <NodeStat label="Volume in" value={money(selected.volume_in)} />
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <NetworkIcon className="h-4 w-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Graph summary</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <NodeStat label="Nodes" value={number(graph.nodes.length)} />
                <NodeStat label="Edges" value={number(graph.edges.length)} />
                <NodeStat label="Ring edges" value={number(cycleEdges.length)} />
                <NodeStat label="Ring nodes" value={number(cycleNodes.size)} />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                Red edges belong to an elementary directed cycle found by NetworkX. Use the ring list below to jump
                into case review.
              </p>
            </div>
          )}

          <div className="card p-5">
            <p className="label mb-3">Detected rings</p>
            <div className="space-y-2">
              {graph.cycles.slice(0, 6).map((cycle) => (
                <div key={cycle.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">Ring #{cycle.id}</span>
                    <Badge tone={cycle.risk_score >= 80 ? "rose" : cycle.risk_score >= 60 ? "amber" : "cyan"}>
                      {Number(cycle.risk_score).toFixed(0)} risk
                    </Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-zinc-500" title={cycle.cycle_key}>
                    {cycle.path.join(" → ")}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {number(cycle.transaction_count)} transfers · {money(cycle.total_amount)}
                  </p>
                </div>
              ))}
              {graph.cycles.length === 0 && (
                <p className="text-xs text-zinc-500">No cycles detected in the current scan.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 800, height: 620 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
