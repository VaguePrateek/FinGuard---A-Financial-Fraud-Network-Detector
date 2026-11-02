const TONES = {
  rose: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  cyan: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  sky: "border-teal-400/25 bg-teal-400/10 text-teal-300",
  violet: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  slate: "border-white/10 bg-white/[0.04] text-zinc-400",
};

export default function Badge({ tone = "slate", children, dot = false, className = "" }) {
  return (
    <span className={`chip ${TONES[tone] || TONES.slate} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function RiskBadge({ score }) {
  const tone = score >= 0.8 ? "rose" : score >= 0.6 ? "amber" : score >= 0.35 ? "sky" : "slate";
  return (
    <Badge tone={tone} dot>
      {Number(score || 0).toFixed(2)} risk
    </Badge>
  );
}

export function StatusBadge({ status }) {
  const tone =
    status === "open" ? "rose" : status === "reviewing" ? "amber" : "emerald";
  return (
    <Badge tone={tone} dot className="capitalize">
      {status}
    </Badge>
  );
}
