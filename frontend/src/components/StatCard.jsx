export default function StatCard({ icon: Icon, label, value, sub, accent = "cyan", delay = 0 }) {
  const accents = {
    cyan: "from-emerald-400/20 to-emerald-400/0 text-emerald-300",
    violet: "from-lime-400/20 to-lime-400/0 text-lime-300",
    rose: "from-rose-400/20 to-rose-400/0 text-rose-300",
    amber: "from-amber-400/20 to-amber-400/0 text-amber-300",
    emerald: "from-emerald-400/20 to-emerald-400/0 text-emerald-300",
  };

  return (
    <div
      className="card card-hover relative overflow-hidden p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl ${accents[accent]}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="label">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-zinc-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`rounded-xl border border-white/10 bg-white/[0.04] p-2.5 ${accents[accent].split(" ").pop()}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
