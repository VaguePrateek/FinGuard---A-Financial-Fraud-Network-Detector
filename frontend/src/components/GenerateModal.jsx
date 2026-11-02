import { useState } from "react";
import { Database, Loader2, Sparkles, X } from "lucide-react";
import { useApp } from "../context/AppContext";

const PRESETS = [
  {
    name: "Demo",
    hint: "Balanced 900-txn ledger",
    values: { n_accounts: 96, n_transactions: 900, n_anomalies: 28, n_rings: 3, ring_size: 4, seed: 42 },
  },
  {
    name: "Stress test",
    hint: "3.2K txns, 6 rings",
    values: { n_accounts: 240, n_transactions: 3200, n_anomalies: 80, n_rings: 6, ring_size: 5, seed: 7 },
  },
  {
    name: "Minimal",
    hint: "Quick 220-txn sample",
    values: { n_accounts: 40, n_transactions: 220, n_anomalies: 10, n_rings: 1, ring_size: 4, seed: 3 },
  },
];

const DEFAULTS = {
  n_accounts: 96,
  n_transactions: 900,
  n_anomalies: 28,
  n_rings: 3,
  ring_size: 4,
  seed: 42,
  run_detection: true,
};

export default function GenerateModal({ open, onClose }) {
  const { generate, generating } = useApp();
  const [form, setForm] = useState(DEFAULTS);

  if (!open) return null;

  const set = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (values) => setForm((prev) => ({ ...prev, ...values }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      await generate({
        n_accounts: Number(form.n_accounts),
        n_transactions: Number(form.n_transactions),
        n_anomalies: Number(form.n_anomalies),
        n_rings: Number(form.n_rings),
        ring_size: Number(form.ring_size),
        seed: form.seed === "" ? null : Number(form.seed),
        run_detection: form.run_detection,
      });
      onClose();
    } catch {
      /* toast already shown */
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-fade-up rounded-2xl border border-white/10 bg-[#06120b] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Synthetic ledger</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">Generate demo data</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Builds accounts, background activity, statistical outliers and circular transfer rings.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.values)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.06]"
            >
              <p className="text-xs font-semibold text-zinc-200">{preset.name}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">{preset.hint}</p>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Accounts">
              <input className="input" type="number" min="20" max="500" value={form.n_accounts} onChange={set("n_accounts")} />
            </Field>
            <Field label="Background transactions">
              <input className="input" type="number" min="50" max="10000" value={form.n_transactions} onChange={set("n_transactions")} />
            </Field>
            <Field label="Injected anomalies">
              <input className="input" type="number" min="0" max="500" value={form.n_anomalies} onChange={set("n_anomalies")} />
            </Field>
            <Field label="Circular rings">
              <input className="input" type="number" min="0" max="20" value={form.n_rings} onChange={set("n_rings")} />
            </Field>
            <Field label="Ring size">
              <input className="input" type="number" min="3" max="8" value={form.ring_size} onChange={set("ring_size")} />
            </Field>
            <Field label="Random seed">
              <input className="input" type="number" value={form.seed} onChange={set("seed")} placeholder="random" />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.run_detection}
              onChange={set("run_detection")}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-400"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-zinc-200">Run detection immediately</span>
              <span className="block text-xs text-zinc-500">Isolation Forest + NetworkX scan after generation</span>
            </span>
            <Database className="h-4 w-4 text-zinc-600" />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={generating}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate ledger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
