import { useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Backdrop, FictionBanner, Logo, ParticleField, StatusDot, TechButton, TechInput, useClock } from "@watcher/ui";
import { PRODUCT } from "@watcher/shared/constants";
import { BootSequence, type BootLine } from "../components/effects/BootSequence";
import { ApiError, requestAccess, type SessionInfo } from "../services/api";
import { useSession } from "../hooks/useSession";
import "./LoginPage.css";

// The enrolment wizard is a separate website; this points to it.
const ENROLL_SITE_URL = import.meta.env.VITE_ENROLL_URL ?? "http://localhost:5175";

const BOOT: BootLine[] = [
  { text: "Initialising WATCHER console…" },
  { text: "Loading interface modules", tone: "ok" },
  { text: "Establishing secure channel (TLS)", tone: "ok" },
  { text: "Rendering subsystems online", tone: "ok" },
  { text: "Awaiting operator credentials…" },
];

const INIT: BootLine[] = [
  { text: "Identity verified", tone: "ok" },
  { text: "Decrypting profile record", tone: "ok" },
  { text: "Calibrating holographic subsystems", tone: "ok" },
  { text: "Loading intelligence workspace…" },
];

type Phase = "boot" | "ready" | "checking" | "granted" | "denied";

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return "AUTH SERVICE UNREACHABLE";
    if (err.status === 429) return "TOO MANY ATTEMPTS — WAIT A MINUTE";
    if (err.status === 422) return "CHECK ID FORMAT · PIN IS 4–12 DIGITS";
  }
  return "ACCESS DENIED";
}

export function LoginPage() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [projectId, setProjectId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { session, status, setSession } = useSession();
  const navigate = useNavigate();
  const { date, time } = useClock();
  const granted = useRef<SessionInfo | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!projectId.trim() || !pin) {
      setError(!projectId.trim() ? "PROJECT ID REQUIRED" : "ACCESS PIN REQUIRED");
      return;
    }
    setError(null);
    setPhase("checking");
    try {
      const s = await requestAccess(projectId.trim(), pin);
      setPin("");
      setPhase("granted");
      // Session is committed to context after the init sequence finishes,
      // so the redirect below doesn't cut the animation short.
      granted.current = s;
    } catch (err) {
      setPhase("denied");
      setPin("");
      setError(messageFor(err));
    }
  }

  function finishInit() {
    if (granted.current) setSession(granted.current);
    navigate("/console", { replace: true });
  }

  // Already signed in (e.g. reload on /login) → straight to the console.
  if (status === "ready" && session && phase !== "granted") return <Navigate to="/console" replace />;

  return (
    <div className="login">
      <Backdrop />
      <ParticleField />
      <FictionBanner />

      <div className="login__frame">
        <header className="login__top">
          <span className="w-label">SYS-ID // WTR-OPS-CONSOLE · BUILD {PRODUCT.build}</span>
          <span className="w-label w-mono-num">
            {date} {time}
          </span>
        </header>

        <div className="login__center">
          <motion.div
            className="login__brand"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Logo size={64} sub={PRODUCT.clientTitle} />
          </motion.div>

          <div className="login__card">
            <span className="login__corner login__corner--tr" aria-hidden />
            <span className="login__corner login__corner--bl" aria-hidden />

            <div className="login__card-head">
              <StatusDot tone={phase === "denied" ? "crit" : phase === "granted" ? "ok" : "info"} />
              <span>SECURE ACCESS TERMINAL</span>
              <span className="login__card-code">AUTH-v1</span>
            </div>

            <div className="login__boot">
              <BootSequence lines={BOOT} onDone={() => setPhase((p) => (p === "boot" ? "ready" : p))} />
            </div>

            <AnimatePresence mode="wait">
              {phase === "granted" ? (
                <motion.div
                  key="granted"
                  className="login__result login__result--ok"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 20 }}
                >
                  SYSTEM ACCESS GRANTED
                  <div className="login__init">
                    <BootSequence lines={INIT} stepMs={420} onDone={() => window.setTimeout(finishInit, 600)} />
                  </div>
                </motion.div>
              ) : phase !== "boot" ? (
                <motion.form
                  key="form"
                  className="login__form"
                  onSubmit={onSubmit}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  noValidate
                >
                  <TechInput
                    label="Project ID"
                    placeholder="000000000000"
                    autoComplete="username"
                    spellCheck={false}
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  />
                  <TechInput
                    label="Access PIN"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••••"
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        className="login__result login__result--bad"
                        role="alert"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <TechButton type="submit" block disabled={phase === "checking"}>
                    {phase === "checking" ? "AUTHENTICATING…" : "AUTHENTICATE"}
                  </TechButton>

                  <div className="login__alt">
                    <span className="w-c-muted">No profile yet?</span>{" "}
                    <a href={ENROLL_SITE_URL}>Create your own profile →</a>
                  </div>
                </motion.form>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <footer className="login__foot">
          <span>WATCHER © {new Date().getFullYear()}</span>
          <span>Profiles are created by their owners · Simulated visuals</span>
        </footer>
      </div>
    </div>
  );
}
