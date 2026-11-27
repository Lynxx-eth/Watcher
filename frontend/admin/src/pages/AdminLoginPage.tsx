import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Backdrop, FictionBanner, Logo, Panel, TechButton, TechInput } from "@watcher/ui";
import { PRODUCT } from "@watcher/shared/constants";
import { ApiError, adminLogin } from "../services/api";
import { useAdminSession } from "../session";

export function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, checking, setSession } = useAdminSession();
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("USERNAME AND PASSWORD REQUIRED");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setSession(await adminLogin(username, password));
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? err.message
          : err instanceof ApiError && err.status === 429
            ? "TOO MANY ATTEMPTS — WAIT A MINUTE"
            : "INVALID CREDENTIALS",
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  if (!checking && session) return <Navigate to="/" replace />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Backdrop />
      <FictionBanner />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
        <motion.div
          style={{ width: "min(400px, 100%)", display: "flex", flexDirection: "column", gap: 28 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Logo size={48} sub={PRODUCT.adminTitle} />
          <Panel title="Administrator Sign-in" code="ADM-AUTH" tools={<span>RESTRICTED</span>}>
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
              <TechInput
                label="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TechInput
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <div className="w-field__error" role="alert">
                  {error}
                </div>
              )}
              <TechButton type="submit" block disabled={busy}>
                {busy ? "Verifying…" : "Sign in"}
              </TechButton>
            </form>
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}
