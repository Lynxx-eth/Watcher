import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { adminLogout, adminMe, type AdminSession } from "./services/api";

interface Ctx {
  session: AdminSession | null;
  checking: boolean;
  setSession: (s: AdminSession | null) => void;
  signOut: () => Promise<void>;
}

const AdminCtx = createContext<Ctx | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    adminMe()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setSession(null);
    }
  }, []);

  return <AdminCtx.Provider value={{ session, checking, setSession, signOut }}>{children}</AdminCtx.Provider>;
}

export function useAdminSession() {
  const v = useContext(AdminCtx);
  if (!v) throw new Error("useAdminSession must be used inside <AdminSessionProvider>");
  return v;
}

/** Render guard only — the backend authorises every admin API call. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, checking } = useAdminSession();
  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }} className="w-label">Verifying admin session…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
