import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  GitBranch,
  Loader2,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "../components/StatCard";
import Badge, { RiskBadge } from "../components/Badge";
import EmptyState, { Skeleton } from "../components/EmptyState";
import { useApp } from "../context/AppContext";
import { getStats } from "../services/api";
import { currency, dateShort, money, number, percent } from "../services/format";

const DEMO_PAYLOAD = {
  n_accounts: 96,
  n_transactions: 900,
  n_anomalies: 28,
  n_rings: 3,
  ring_size: 4,
  seed: 42,
  run_detection: true,
};

const PIE_COLORS = ["#34d399", "#84cc16", "#2dd4bf", "#f59e0b", "#fb7185"];

export default function Dashboard() {
  const { version, detect, detecting, generate, generating } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStats()
      .then((data) => {
        if (!active) return;
        setStats(data);
        setError(null);
      })
      .catch((err) => active && setError(err.message || "Failed to load stats"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [version]);

  if (loading && !stats) return <DashboardSkeleton />;

  if (error && !stats) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Could not reach the API"
        message="The dashboard could not load ledger statistics. Make sure the FastAPI backend is running on port 8000."
        action={
          <button className="btn-ghost" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        }
      />
    );
  }

  if (!stats || stats.transaction_count === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="No ledger loaded yet"
        message="Generate a synthetic financial ledger with injected statistical outliers and circular transfer rings, then let Isolation Forest and NetworkX surface the risk."
        action={
          <button className="btn-primary" onClick={() => generate(DEMO_PAYLOAD)} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating demo ledger…" : "Generate demo ledger"}
          </button>
        }
      />
    );
  }

  const detection = stats.detection;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Financial crime posture</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {number(stats.transaction_count)} transactions under surveillance
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {dateShort(stats.data_start)} → {dateShort(stats.data_end)} · {number(stats.account_count)} accounts ·{" "}
            {money(stats.avg_amount)} average ticket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/anomalies" className="btn-ghost">
            <ShieldAlert className="h-4 w-4 text-rose-300" /> Review anomalies
          </Link>
          <button className="btn-ghost" onClick={() => detect()} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4 text-emerald-300" />}
            {detecting ? "Scanning…" : "Re-run detection"}
          </button>
          <Link to="/cycles" className="btn-primary">
            <GitBranch className="h-4 w-4" /> Review cycles
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Ledger volume"
          value={currency(stats.ledger_volume)}
          sub={`${number(stats.transaction_count)} transactions monitored`}
          accent="cyan"
          delay={0}
        />
        <StatCard
          icon={Activity}
          label="Anomalies flagged"
          value={number(stats.anomaly_count)}
          sub={`${number(stats.clean_count)} clean · Isolation Forest`}
          accent="rose"
          delay={60}
        />
        <StatCard
          icon={GitBranch}
          label="Circular flows"
          value={number(stats.cycle_count)}
          sub={`${number(stats.cycle_transaction_count)} transactions inside rings`}
          accent="violet"
          delay={120}
        />
        <StatCard
          icon={Users}
          label="High-risk accounts"
          value={number(stats.high_risk_accounts)}
          sub={`of ${number(stats.account_count)} monitored entities`}
          accent="amber"
          delay={180}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Transaction activity"
          subtitle="Daily volume with flagged transactions"
          action={<Badge tone="cyan" dot>{stats.trend.length} days</Badge>}
        >
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="flagFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(110,143,126,0.12)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={dateShort}
                  tick={{ fill: "#6f8f7f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis tick={{ fill: "#6f8f7f", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Transactions" stroke="#34d399" strokeWidth={2} fill="url(#totalFill)" />
                <Area type="monotone" dataKey="flagged" name="Flagged" stroke="#fb7185" strokeWidth={2} fill="url(#flagFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Detection quality"
          subtitle="Latest model evaluation"
          action={
            detection ? (
              <Badge tone="emerald" dot>run #{detection.id}</Badge>
            ) : (
              <Badge tone="amber">not run</Badge>
            )
          }
        >
          {detection ? (
            <div className="space-y-4">
              <Metric label="Precision" value={percent(detection.precision_score)} raw={detection.precision_score} tone="cyan" />
              <Metric label="Recall" value={percent(detection.recall_score)} raw={detection.recall_score} tone="violet" />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <MiniStat label="Analysed" value={number(detection.transactions_analyzed)} />
                <MiniStat label="Anomalies" value={number(detection.anomalies_detected)} />
                <MiniStat label="Cycles" value={number(detection.cycles_detected)} />
                <MiniStat label="Scan time" value={`${detection.duration_ms} ms`} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs">
                <span className="text-zinc-500">Contamination</span>
                <span className="font-mono text-zinc-300">{detection.contamination}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-[290px] flex-col items-center justify-center text-center">
              <Radar className="mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">No detection run yet</p>
              <p className="mt-1 max-w-[220px] text-xs text-zinc-500">
                Run a scan to score anomalies and trace circular flows.
              </p>
              <button className="btn-primary mt-4" onClick={() => detect()} disabled={detecting}>
                {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                Run first scan
              </button>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Transaction mix" subtitle="Count by instrument">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.type_breakdown}
                  dataKey="count"
                  nameKey="txn_type"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={3}
                  stroke="none"
                >
                  {stats.type_breakdown.map((entry, index) => (
                    <Cell key={entry.txn_type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {stats.type_breakdown.map((item, index) => (
              <div key={item.txn_type} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                <span className="text-zinc-400">{item.txn_type}</span>
                <span className="ml-auto font-mono text-zinc-500">{number(item.count)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Anomaly score bands" subtitle="Distribution across the ledger">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.anomaly_bands} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(110,143,126,0.12)" vertical={false} />
                <XAxis dataKey="band" tick={{ fill: "#6f8f7f", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6f8f7f", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Transactions" radius={[6, 6, 0, 0]}>
                  {stats.anomaly_bands.map((entry, index) => (
                    <Cell key={entry.band} fill={index >= 3 ? "#fb7185" : index >= 2 ? "#f59e0b" : "#34d399"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Scores above 0.6 are prioritised for analyst review.
          </p>
        </Panel>

        <Panel
          title="Highest-risk accounts"
          subtitle="Ranked by anomalies, then cycles"
          action={
            <Link to="/transactions" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
              <span className="inline-flex items-center gap-1">View ledger <ArrowUpRight className="h-3 w-3" /></span>
            </Link>
          }
        >
          <div className="-mx-1 space-y-1">
            {stats.top_accounts.slice(0, 6).map((account) => (
              <Link
                key={account.account_id}
                to={`/transactions?search=${encodeURIComponent(account.account_id)}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-[10px] font-bold text-zinc-400">
                  {account.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-zinc-200">{account.name}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    {account.account_id} · {account.account_type}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {account.anomaly_count > 0 && <Badge tone="rose">{account.anomaly_count}A</Badge>}
                  {account.cycle_count > 0 && <Badge tone="violet">{account.cycle_count}C</Badge>}
                </div>
                <RiskBadge score={account.risk_score} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, raw, tone }) {
  const width = raw === null || raw === undefined ? 0 : Math.round(raw * 100);
  const bar = tone === "cyan" ? "bg-emerald-400" : "bg-lime-400";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="text-lg font-bold text-white">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#06120b]/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color || entry.fill }} />
          {entry.name}: <span className="font-mono text-white">{typeof entry.value === "number" ? number(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[360px] xl:col-span-2" />
        <Skeleton className="h-[360px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[320px]" />
        ))}
      </div>
    </div>
  );
}
