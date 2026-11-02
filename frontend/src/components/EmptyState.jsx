import { Sparkles } from "lucide-react";

export default function EmptyState({ icon: Icon = Sparkles, title, message, action }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-300">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-zinc-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/[0.04] ${className}`}>
      <div className="absolute inset-0 -tranzinc-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}
