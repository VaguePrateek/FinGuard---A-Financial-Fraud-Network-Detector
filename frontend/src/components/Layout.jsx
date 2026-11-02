import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowLeftRight,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Menu,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import GenerateModal from "./GenerateModal";
import Toasts from "./Toasts";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, title: "Risk overview", subtitle: "Portfolio-wide ledger posture" },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight, title: "Transactions", subtitle: "Explore the full ledger" },
  { to: "/anomalies", label: "Anomalies", icon: ShieldAlert, title: "Anomalies", subtitle: "Isolation Forest signals and triage queue" },
  { to: "/cycles", label: "Circular flows", icon: GitBranch, title: "Circular flows", subtitle: "Money rings detected with NetworkX" },
  { to: "/network", label: "Network", icon: Network, title: "Network graph", subtitle: "Account relationship map" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-zinc-950 shadow-glow">
        <ShieldCheck className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <div>
        <p className="text-[15px] font-bold tracking-tight text-white">
          Fin<span className="text-gradient">Guard</span>
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Ledger intelligence</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { health } = useApp();
  const online = health?.status === "ok";

  return (
    <div className="flex h-full flex-col">
      <Brand />
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-400/[0.09] text-emerald-200"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 h-5 w-[3px] rounded-r-full bg-emerald-400 transition ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon className={`h-[18px] w-[18px] ${isActive ? "text-emerald-300" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="label mb-2">Detection stack</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="h-3.5 w-3.5 text-lime-300" />
            Isolation Forest
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <GitBranch className="h-3.5 w-3.5 text-emerald-300" />
            NetworkX cycles
          </div>
        </div>
      </div>

      <div className="mx-3 mb-5 flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-xs">
        <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.4)]" : "bg-rose-400"}`} />
        <span className="text-zinc-400">{online ? "API online" : "API offline"}</span>
        {online && <span className="ml-auto text-zinc-600">{health.transactions} txns</span>}
      </div>
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { detecting, detect } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const meta = useMemo(() => NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) || NAV[0], [pathname]);

  return (
    <div className="min-h-screen lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-white/[0.06] bg-[#030b06]/80 backdrop-blur-xl lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[270px] border-r border-white/10 bg-[#030b06]">
            <button
              className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-white/5"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#020604]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-white">{meta.title}</h1>
            <p className="hidden truncate text-xs text-zinc-500 sm:block">{meta.subtitle}</p>
          </div>

          <button className="btn-ghost hidden sm:inline-flex" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="h-4 w-4 text-emerald-300" />
            Generate data
          </button>
          <button className="btn-primary" onClick={() => detect()} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            <span className="hidden sm:inline">{detecting ? "Scanning…" : "Run scan"}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <GenerateModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <Toasts />
    </div>
  );
}
