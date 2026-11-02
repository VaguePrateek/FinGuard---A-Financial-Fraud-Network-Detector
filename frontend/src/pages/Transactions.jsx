import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import TransactionModal from "../components/TransactionModal";
import { useApp } from "../context/AppContext";
import { getTransactions } from "../services/api";
import { dateTime, money, number } from "../services/format";

const TYPES = ["TRANSFER", "PAYMENT", "WITHDRAWAL", "DEPOSIT", "REFUND"];

export default function Transactions() {
  const { version } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [txnType, setTxnType] = useState("");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [cycleOnly, setCycleOnly] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sort, setSort] = useState("timestamp");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (search) next.set("search", search);
    else next.delete("search");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, txnType, anomalyOnly, cycleOnly, minAmount, maxAmount, pageSize]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = { page, page_size: pageSize, sort, order };
    if (search) params.search = search;
    if (txnType) params.txn_type = txnType;
    if (anomalyOnly) params.anomaly_only = true;
    if (cycleOnly) params.cycle_only = true;
    if (minAmount !== "") params.min_amount = Number(minAmount);
    if (maxAmount !== "") params.max_amount = Number(maxAmount);

    getTransactions(params)
      .then((result) => active && setData(result))
      .catch(() => active && setData({ total: 0, items: [] }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, pageSize, search, txnType, anomalyOnly, cycleOnly, minAmount, maxAmount, sort, order, version]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const filtersActive = search || txnType || anomalyOnly || cycleOnly || minAmount !== "" || maxAmount !== "";

  const toggleSort = (column) => {
    if (sort === column) setOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    else {
      setSort(column);
      setOrder("desc");
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setTxnType("");
    setAnomalyOnly(false);
    setCycleOnly(false);
    setMinAmount("");
    setMaxAmount("");
  };

  const exportCsv = () => {
    const rows = data.items;
    if (!rows.length) return;
    const header = ["txn_id", "account_id", "counterparty", "amount", "currency", "txn_type", "channel", "timestamp", "is_anomaly", "anomaly_score", "in_cycle", "cycle_id"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((key) => {
            const value = r[key] ?? "";
            return typeof value === "string" && value.includes(",") ? `"${value}"` : value;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finguard-transactions-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (column) => {
    if (sort !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return order === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-300" /> : <ArrowUp className="h-3 w-3 text-emerald-300" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Ledger explorer</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {number(data.total)} transactions
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Search, filter and inspect individual ledger entries.
          </p>
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={!data.items.length}>
          <Download className="h-4 w-4" /> Export page CSV
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -tranzinc-y-1/2 text-zinc-500" />
            <input
              className="input pl-9"
              placeholder="Search txn id, account, counterparty or description…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                className="absolute right-2.5 top-1/2 -tranzinc-y-1/2 rounded p-1 text-zinc-500 hover:bg-white/10"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -tranzinc-y-1/2 text-zinc-500" />
              <select className="input appearance-none pl-8 pr-8" value={txnType} onChange={(e) => setTxnType(e.target.value)}>
                <option value="">All types</option>
                {TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <input className="input w-28" type="number" placeholder="Min $" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            <input className="input w-28" type="number" placeholder="Max $" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            <button
              onClick={() => setAnomalyOnly((v) => !v)}
              className={`chip transition ${anomalyOnly ? "border-rose-400/40 bg-rose-400/15 text-rose-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> Anomalies
            </button>
            <button
              onClick={() => setCycleOnly((v) => !v)}
              className={`chip transition ${cycleOnly ? "border-lime-400/40 bg-lime-400/15 text-lime-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> In cycle
            </button>
            {filtersActive && (
              <button className="chip border-white/10 text-zinc-400 hover:text-white" onClick={resetFilters}>
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Filter className="h-3.5 w-3.5" />
            {loading ? "Loading…" : `Showing ${data.items.length} of ${number(data.total)}`}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Rows</span>
            <select
              className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-300 outline-none"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No transactions match"
            message="Try relaxing the filters or search for a different account, counterparty or transaction id."
            action={<button className="btn-ghost" onClick={resetFilters}>Clear filters</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-5 py-3 font-semibold">Transaction</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Counterparty</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <button className="inline-flex items-center gap-1 hover:text-zinc-300" onClick={() => toggleSort("amount")}>
                      Amount {sortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button className="inline-flex items-center gap-1 hover:text-zinc-300" onClick={() => toggleSort("timestamp")}>
                      Time {sortIcon("timestamp")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <button className="inline-flex items-center gap-1 hover:text-zinc-300" onClick={() => toggleSort("anomaly_score")}>
                      Risk {sortIcon("anomaly_score")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((txn) => (
                  <tr
                    key={txn.txn_id}
                    onClick={() => setSelected(txn)}
                    className="cursor-pointer border-t border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-zinc-200">{txn.txn_id}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{txn.channel} · {txn.currency}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-300/90">{txn.account_id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{txn.counterparty}</td>
                    <td className="px-4 py-3">
                      <Badge tone={txn.txn_type === "TRANSFER" ? "sky" : "slate"}>{txn.txn_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-zinc-200">{money(txn.amount)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{dateTime(txn.timestamp)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {txn.is_anomaly && (
                          <Badge tone="rose" dot>{(txn.anomaly_score * 100).toFixed(0)}%</Badge>
                        )}
                        {txn.in_cycle && <Badge tone="violet">cycle #{txn.cycle_id}</Badge>}
                        {!txn.is_anomaly && !txn.in_cycle && <Badge tone="slate">clean</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selected && <TransactionModal txn={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
