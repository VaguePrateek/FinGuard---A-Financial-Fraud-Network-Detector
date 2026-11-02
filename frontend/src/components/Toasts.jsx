import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useApp } from "../context/AppContext";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  success: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-300",
  error: "border-rose-400/30 bg-rose-400/[0.07] text-rose-300",
  info: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-300",
};

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex w-[min(92vw,380px)] flex-col gap-2.5">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone] || Info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl animate-fade-up ${TONES[toast.tone] || TONES.info}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-relaxed">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-current/60 transition hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
