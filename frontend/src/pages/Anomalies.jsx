import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import Badge from "../components/Badge";
import EmptyState, { Skeleton } from "../components/EmptyState";
import StatCard from "../components/StatCard";
import TransactionModal from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import { getStats, getTransactions } from "../services/api";
import { currency, dateTime, money, number, percent } from "../services/format";

const PAGE_SIZE = 12;
const BAND_COLORS = ["#34d399", "#2dd4bf", "#f59e0b", "#fb7185", "#e11d48"];

export default function Anomalies() {
  const { version, detect, detecting } = useApp();
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [normalSample, setNormalSample] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getStats(),
      getTransactions({ anomaly_only: true, page_size: 200, sort: "anomaly_score", order: "desc" }),
      getTransactions({ page_size: 200 }),
    ])
      .then(([statsResult, anomalyResult, ledgerResult]) => {
        if (!active) return;
        setStats(statsResult);
        setAnomalies(anomalyResult.items || []);
        setNormalSample((ledgerResult.items || []).filter((txn) => !txn.is_anomaly).slice(0, 120));
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Could not load anomaly signals.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [version]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return anomalies;
    return anomalies.filter((txn) =>
      [txn.txn_id, txn.account_id, txn.counterparty, txn.anomaly_reason, txn.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [anomalies, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const flaggedValue = anomalies.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  const avgScore = anomalies.length
    ? (anomalies.reduce((sum, txn) => sum + Number(txn.anomaly_score || 0), 0) / anomalies.length) * 100
    : 0;
  const precision = stats?.detection?.precision_score;
  const recall = stats?.detection?.recall_score;

  const anomalyPoints = anomalies.map((txn) => ({
    x: txn.amount,
    y: Number(txn.anomaly_score || 0) * 100,
    size: Math.max(20, Number(txn.amount || 0) / 2000),
    txn,
  }));
  const normalPoints = normalSample.map((txn) => ({
    x: txn.amount,
    y: Number(txn.anomaly_score || 0) * 100,
    size: Math.max(18, Number(txn.amount || 0) / 2000),
    txn,
  }));

  if (loading && !stats) return <AnomaliesSkeleton />;

  if (error && !stats) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Anomaly signals unavailable"
        message="The Isolation Forest results could not be loaded. Confirm the FastAPI service is running and try again."
        action={
          <button className="btn-ghost" onClick={() => window.location.reload()}>
            <Radar className="h-4 w-4" /> Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Isolation Forest</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {number(stats?.anomaly_count || 0)} anomalies flagged
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Unsupervised outliers scored across amount, velocity, counterparty and graph-aware features.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/transactions" className="btn-ghost">
            <ArrowUpRight className="h-4 w-4 text-emerald-300" /> Open ledger
          </Link>
          <button className="btn-primary" onClick={() => detect()} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {detecting ? "Scanning…" : "Run scan"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShieldAlert}
          label="Flagged anomalies"
          value={number(stats?.anomaly_count || 0)}
          sub={`${number(stats?.transaction_count || 0)} transactions analysed`}
          accent="rose"
        />
        <StatCard
          icon={Crosshair}
          label="Mean anomaly score"
          value={`${avgScore.toFixed(1)}`}
          sub="Normalized 0 – 100 model score"
          accent="violet"
        />
        <StatCard
          icon={Banknote}
          label="Flagged value"
          value={currency(flaggedValue)}
          sub={`${money(anomalies.length ? flaggedValue / anomalies.length : 0)} average ticket`}
          accent="amber"
        />
        <StatCard
          icon={ShieldCheck}
          label="Model precision"
          value={percent(precision)}
          sub={`Recall ${percent(recall)} · contamination ${stats?.detection?.contamination ?? "—"}`}
          accent="cyan"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Amount vs anomaly score</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Flagged transactions plotted against a 120-row clean background sample
              </p>
            </div>
            <Badge tone="rose" dot>
              {number(anomalies.length)} signals
            </Badge>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 18, bottom: 8, left: -6 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(110,143,126,0.12)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Amount"
                  tickFormatter={(value) => currency(value)}
                  tick={{ fill: "#6f8f7f", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "dataMax"]}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Score"
                  domain={[0, 100]}
                  tick={{ fill: "#6f8f7f", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <ZAxis type="number" dataKey="size" range={[28, 130]} />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "#8aa899", paddingBottom: 6 }}
                />
                <Scatter name="Clean sample" data={normalPoints} fill="#445d4f" fillOpacity={0.55} />
                <Scatter name="Anomalies" data={anomalyPoints} fill="#fb7185" fillOpacity={0.9} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <h3 className="text-sm font-semibold text-white">Score distribution</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Share of ledger by model score band</p>
            <div className="mt-4 h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.anomaly_bands || []} margin={{ top: 6, right: 2, left: -26, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(110,143,126,0.10)" vertical={false} />
                  <XAxis dataKey="band" tick={{ fill: "#6f8f7f", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6f8f7f", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BandTooltip />} />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {(stats?.anomaly_bands || []).map((entry, index) => (
                      <Cell key={entry.band} fill={BAND_COLORS[index % BAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2 text-lime-300">
              <Sparkles className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Model insight</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Isolation Forest isolates anomalies with fewer random splits. The model consumes transaction amount,
              log amount, global and account-level z-scores, counterparty rarity, account degree, daily velocity and
              a round-amount signal.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["amount", "z-score", "velocity", "counterparty", "degree", "round-amount"].map((feature) => (
                <Badge key={feature} tone="violet">
                  {feature}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs">
              <span className="text-zinc-500">Contamination</span>
              <span className="font-mono text-zinc-300">{stats?.detection?.contamination ?? "—"}</span>
            </div>
          </section>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Prioritised anomaly queue</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {number(filtered.length)} flagged transactions · ranked by model score
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -tranzinc-y-1/2 text-zinc-500" />
            <input
              className="input pl-9"
              placeholder="Filter by account, txn or reason…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-zinc-300">No anomalies match this filter</p>
            <p className="mt-1 text-xs text-zinc-500">Clear the search or run a new scan to refresh the queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3 font-semibold">Transaction</th>
                  <th className="px-4 py-3 font-semibold">Route</th>
                  <th className="px-4 py-3 font-semibold">Why flagged</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((txn) => {
                  const score = Number(txn.anomaly_score || 0) * 100;
                  return (
                    <tr
                      key={txn.txn_id}
                      onClick={() => setSelected(txn)}
                      className="cursor-pointer border-t border-white/[0.04] transition hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs text-zinc-200">{txn.txn_id}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-600">
                          {txn.channel} · {txn.txn_type}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-emerald-300/90">{txn.account_id}</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-zinc-600" />
                        <span className="font-mono text-[11px] text-zinc-400">{txn.counterparty}</span>
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="truncate text-xs text-zinc-400" title={txn.anomaly_reason || ""}>
                          {txn.anomaly_reason || "Unusual multivariate pattern"}
                        </p>
                        {txn.in_cycle && <Badge tone="violet" className="mt-1">cycle #{txn.cycle_id}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-zinc-200">
                        {money(txn.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className={`h-full rounded-full ${score >= 80 ? "bg-rose-400" : score >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                              style={{ width: `${Math.max(4, score)}%` }}
                            />
                          </div>
                          <span className="w-9 font-mono text-[11px] text-zinc-300">{score.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{dateTime(txn.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {selected && <TransactionModal txn={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point?.txn) return null;
  return (
    <div className="max-w-[260px] rounded-xl border border-white/10 bg-[#06120b]/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="font-mono text-[10px] text-zinc-500">{point.txn.txn_id}</p>
      <p className="mt-1 text-xs font-semibold text-white">{money(point.txn.amount)}</p>
      <p className="mt-0.5 text-[11px] text-zinc-400">Score {Number(point.txn.anomaly_score || 0).toFixed(3)}</p>
      <p className="mt-1 line-clamp-2 text-[10px] text-zinc-500">{point.txn.anomaly_reason}</p>
    </div>
  );
}

function BandTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#06120b]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Score {label}</p>
      <p className="mt-1 font-mono text-white">{number(payload[0].value)} transactions</p>
    </div>
  );
}

function AnomaliesSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[420px] xl:col-span-2" />
        <Skeleton className="h-[420px]" />
      </div>
    </div>
  );
}
