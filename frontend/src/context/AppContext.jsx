import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { generateLedger, getHealth, getErrorMessage, runDetection } from "../services/api";

const AppContext = createContext(null);

let toastId = 0;

export function AppProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [health, setHealth] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const pushToast = useCallback((message, tone = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, tone }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 4800);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      setHealth(await getHealth());
    } catch {
      setHealth({ status: "offline" });
    }
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => {
      clearInterval(interval);
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [loadHealth]);

  const generate = useCallback(
    async (payload) => {
      setGenerating(true);
      try {
        const result = await generateLedger(payload);
        refresh();
        loadHealth();
        pushToast(
          `Ledger generated — ${result.transactions} transactions, ${result.rings_injected} rings injected.`,
          "success"
        );
        if (result.detection) {
          pushToast(
            `Detection: ${result.detection.anomalies_detected} anomalies · ${result.detection.cycles_detected} cycles.`,
            "info"
          );
        }
        return result;
      } catch (error) {
        pushToast(getErrorMessage(error), "error");
        throw error;
      } finally {
        setGenerating(false);
      }
    },
    [loadHealth, pushToast, refresh]
  );

  const detect = useCallback(
    async (contamination = 0.03) => {
      setDetecting(true);
      try {
        const result = await runDetection({ contamination });
        refresh();
        loadHealth();
        pushToast(
          `Scan complete — ${result.anomalies_detected} anomalies, ${result.cycles_detected} cycles in ${result.duration_ms} ms.`,
          "success"
        );
        return result;
      } catch (error) {
        pushToast(getErrorMessage(error), "error");
        throw error;
      } finally {
        setDetecting(false);
      }
    },
    [loadHealth, pushToast, refresh]
  );

  const value = useMemo(
    () => ({
      version,
      refresh,
      health,
      generating,
      detecting,
      generate,
      detect,
      toasts,
      pushToast,
      dismissToast,
    }),
    [version, refresh, health, generating, detecting, generate, detect, toasts, pushToast, dismissToast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
