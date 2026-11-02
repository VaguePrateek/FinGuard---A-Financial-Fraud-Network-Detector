import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import Badge, { StatusBadge } from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import { getCycle, getCycles, updateCycleStatus } from "../services/api";
import { dateTime, money, number } from "../services/format";

const FILTERS = [
  { key: "all", label: "All rings" },
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "dismissed", label: "Dismissed" },
];

export default function Cycles() {
  const { version, pushToast } = useApp();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);

  const load = () => {
    setLoading(true);
    getCycles()
      .then(setCycles)
      .catch(() => setCycles([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [version]);

  const filtered = useMemo(
    () => (filter === "all" ? cycles : cycles.filter((c) => c.status === filter)),
    [cycles, filter]
  );

  const totals = useMemo(() => {
    const amount = cycles.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);
    const avgRisk = cycles.length
      ? cycles.reduce((sum, c) => sum + Number(c.risk_score || 0), 0) / cycles.length
      : 0;
    return {
      amount,
      avgRisk,
      open: cycles.filter((c) => c.status === "open").length,
      txns: cycles.reduce((sum, c) => sum + Number(c.transaction_count || 0), 0),
    };
  }, [cycles]);

  const changeStatus = async (id, status) => {
    const previous = cycles;
    setCycles((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await updateCycleStatus(id, status);
      pushToast(`Ring #${id} marked ${status}.`, "success");
    } catch {
      setCycles(previous);
      pushToast("Could not update ring status.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">NetworkX detection</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {number(cycles.length)} circular flows detected
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Elementary directed cycles in the account graph, ranked by amount and velocity.
          </p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Rings found" value={number(cycles.length)} sub={`${totals.open} awaiting review`} />
        <Summary label="Value in rings" value={money(totals.amount)} sub={`${number(totals.txns)} transactions involved`} />
        <Summary label="Average risk" value={totals.avgRisk.toFixed(1)} sub="Weighted model score / 100" />
        <Summary label="Longest ring" value={cycles.length ? `${Math.max(...cycles.map((c) => c.size))} hops` : "—"} sub="Cycle length in accounts" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`chip transition ${
              filter === item.key
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {item.label}
            <span className="ml-1 font-mono text-[10px] opacity-70">
              {item.key === "all" ? cycles.length : cycles.filter((c) => c.status === item.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={cycles.length ? "No rings in this state" : "No circular flows detected"}
          message={
            cycles.length
              ? "Switch the status filter to see other rings."
              : "Run a detection scan after generating a ledger. NetworkX looks for directed loops such as A → B → C → A."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((cycle) => (
            <article key={cycle.id} className="card card-hover overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <RiskGauge score={cycle.risk_score} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Ring #{cycle.id}
                    </p>
                    <StatusBadge status={cycle.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {cycle.path.map((node, index) => (
                      <span key={`${node}-${index}`} className="flex items-center gap-1.5">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          {node}
                        </span>
                        {index < cycle.path.length - 1 && <ArrowRight className="h-3 w-3 text-zinc-600" />}
                      </span>
                    ))}
                    <ArrowRight className="h-3 w-3 text-lime-400/70" />
                  </div>
                  <p className="mt-2 truncate text-xs text-zinc-500" title={cycle.cycle_key}>
                    {cycle.size}-account loop · {number(cycle.transaction_count)} transfers
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px border-y border-white/[0.06] bg-white/[0.02]">
                <Cell label="Flow value" value={money(cycle.total_amount)} />
                <Cell label="Transfers" value={number(cycle.transaction_count)} />
                <Cell label="Detected" value={cycle.created_at ? dateTime(cycle.created_at) : "—"} small />
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <select
                  value={cycle.status}
                  onChange={(event) => changeStatus(cycle.id, event.target.value)}
                  className="rounded-lg border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-emerald-400/40"
                >
                  <option value="open">Open</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="dismissed">Dismissed</option>
                </select>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setActiveId(cycle.id)}>
                  Inspect ring <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeId && (
        <CycleDrawer
          cycleId={activeId}
          onClose={() => setActiveId(null)}
          onStatusChange={(status) => {
            setCycles((prev) => prev.map((c) => (c.id === activeId ? { ...c, status } : c)));
          }}
          pushToast={pushToast}
        />
      )}
    </div>
  );
}

function Summary({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function Cell({ label, value, small = false }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={`mt-0.5 font-semibold text-zinc-300 ${small ? "text-[10px]" : "text-xs"}`}>{value}</p>
    </div>
  );
}

function RiskGauge({ score }) {
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#fb7185" : value >= 60 ? "#f59e0b" : "#34d399";

  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-sm font-bold text-white">{value.toFixed(0)}</p>
        <p className="text-[8px] uppercase tracking-wider text-zinc-500">risk</p>
      </div>
    </div>
  );
}

function CycleDrawer({ cycleId, onClose, onStatusChange, pushToast }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCycle(cycleId)
      .then((data) => active && setDetail(data))
      .catch(() => active && setDetail(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cycleId]);

  const changeStatus = async (status) => {
    try {
      await updateCycleStatus(cycleId, status);
      setDetail((prev) => (prev ? { ...prev, status } : prev));
      onStatusChange(status);
      pushToast(`Ring #${cycleId} marked ${status}.`, "success");
    } catch {
      pushToast("Could not update ring status.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl animate-fade-up overflow-y-auto border-l border-white/10 bg-[#04100a] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.06] bg-[#04100a]/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="label">Circular flow</p>
            <h3 className="mt-1 text-lg font-bold text-white">Ring #{cycleId}</h3>
          </div>
          <button className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !detail ? (
          <div className="p-6">
            <EmptyState icon={ShieldAlert} title="Ring unavailable" message="This cycle could not be loaded. Re-run detection and try again." />
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge status={detail.status} />
              <select
                value={detail.status}
                onChange={(event) => changeStatus(event.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
              >
                <option value="open">Open</option>
                <option value="reviewing">Reviewing</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <DrawerStat label="Flow value" value={money(detail.total_amount)} />
              <DrawerStat label="Risk score" value={Number(detail.risk_score).toFixed(1)} />
              <DrawerStat label="Transfers" value={number(detail.transaction_count)} />
            </div>

            <div>
              <p className="label mb-2">Ring path</p>
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                {detail.path.map((node, index) => (
                  <span key={`${node}-${index}`} className="flex items-center gap-1.5">
                    <span className="rounded-md border border-lime-400/20 bg-lime-400/[0.08] px-2 py-1 font-mono text-[11px] text-lime-200">
                      {node}
                    </span>
                    {index < detail.path.length - 1 && <ArrowRight className="h-3 w-3 text-zinc-600" />}
                  </span>
                ))}
                <ArrowRight className="h-3 w-3 text-lime-400/70" />
              </div>
            </div>

            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Why it matters</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                Funds return to their origin after {detail.size} hops, a common layering pattern used to obscure
                source and destination. Review the underlying transfers before closing the case.
              </p>
            </div>

            <div>
              <p className="label mb-2">Transfers in ring</p>
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Txn</th>
                      <th className="px-3 py-2 text-left font-semibold">Route</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 text-left font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.transactions.map((txn) => (
                      <tr key={txn.txn_id} className="border-t border-white/[0.04]">
                        <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">{txn.txn_id}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-[10px] text-emerald-300/80">{txn.account_id}</span>
                          <ArrowRight className="mx-1 inline h-2.5 w-2.5 text-zinc-600" />
                          <span className="font-mono text-[10px] text-zinc-400">{txn.counterparty}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[10px] font-semibold text-zinc-200">{money(txn.amount)}</td>
                        <td className="px-3 py-2 text-[10px] text-zinc-500">{dateTime(txn.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function DrawerStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
