import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { fetchSession, logout as apiLogout, type SessionInfo } from "../services/api";

type Status = "checking" | "ready";

interface SessionCtx {
  session: SessionInfo | null;
  status: Status;
  setSession: (s: SessionInfo | null) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<Status>("checking");

  // On first load, ask the backend whether the httpOnly cookie is still valid.
  useEffect(() => {
    let alive = true;
    fetchSession()
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession(null))
      .finally(() => alive && setStatus("ready"));
    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setSession(null);
    }
  }, []);

  return <Ctx.Provider value={{ session, status, setSession, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}

/**
 * Render guard. The real enforcement is server-side: every API call is
 * authorised against the session cookie, so bypassing this guard yields no data.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, status } = useSession();
  const loc = useLocation();
  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }} className="w-label">
        Verifying session…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
