import { useEffect } from "react";
import { X } from "lucide-react";
import Badge from "./Badge";
import { dateTime, money } from "../services/format";

export default function TransactionModal({ txn, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md animate-fade-up overflow-y-auto rounded-2xl border border-white/10 bg-[#06120b] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="label">Transaction detail</p>
            <h3 className="mt-1 font-mono text-sm font-semibold text-white">{txn.txn_id}</h3>
          </div>
          <button
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            onClick={onClose}
            aria-label="Close transaction detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-3xl font-bold tracking-tight text-white">{money(txn.amount)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="sky">{txn.txn_type}</Badge>
            <Badge tone="slate">{txn.channel}</Badge>
            {txn.is_anomaly && <Badge tone="rose" dot>anomaly</Badge>}
            {txn.in_cycle && <Badge tone="violet">cycle #{txn.cycle_id}</Badge>}
            {txn.is_fraud_truth && <Badge tone="amber">synthetic fraud</Badge>}
            {!txn.is_anomaly && !txn.in_cycle && <Badge tone="emerald">clean</Badge>}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <Detail label="Account" value={txn.account_id} mono />
          <Detail label="Counterparty" value={txn.counterparty} mono />
          <Detail label="Timestamp" value={dateTime(txn.timestamp)} />
          <Detail label="Currency" value={txn.currency} />
          <Detail label="Anomaly score" value={(txn.anomaly_score ?? 0).toFixed(4)} />
          <Detail label="Cycle id" value={txn.cycle_id ?? "—"} />
        </dl>

        {txn.description && (
          <div className="mt-4">
            <p className="label mb-1">Description</p>
            <p className="text-xs leading-relaxed text-zinc-400">{txn.description}</p>
          </div>
        )}

        {txn.anomaly_reason && (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">Why it was flagged</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-100/80">{txn.anomaly_reason}</p>
          </div>
        )}

        {txn.in_cycle && (
          <div className="mt-3 rounded-xl border border-lime-400/20 bg-lime-400/[0.06] px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-lime-300">Graph evidence</p>
            <p className="mt-1 text-xs leading-relaxed text-lime-100/70">
              This edge is part of an elementary directed cycle enumerated by NetworkX. Open Circular flows to
              review the full ring.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className={`mt-0.5 text-zinc-300 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
