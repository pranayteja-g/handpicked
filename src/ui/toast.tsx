import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastCtx = { toast: (msg: string) => void };
const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
