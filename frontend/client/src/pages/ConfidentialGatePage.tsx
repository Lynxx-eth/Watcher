import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Panel, StatusDot, TechButton, TechInput } from "@watcher/ui";
import { BootSequence, type BootLine } from "../components/effects/BootSequence";
import { ApiError, confidentialStatus, unlockConfidential } from "../services/api";
import "./ConfidentialPage.css";

const VERIFY: BootLine[] = [
  { text: "Binding request to active session", tone: "ok" },
  { text: "Verifying project identifier", tone: "ok" },
  { text: "Validating access PIN", tone: "ok" },
  { text: "Opening confidential environment…" },
];

type Phase = "form" | "checking" | "granted";

export function ConfidentialGatePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("form");
  const [pid, setPid] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already unlocked (e.g. came back via the nav) → go straight in.
  useEffect(() => {
    confidentialStatus()
      .then((s) => s.unlocked && navigate("/confidential", { replace: true }))
      .catch(() => undefined);
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pid.trim() || !pin) return setError("PROJECT ID AND PIN REQUIRED");
    setError(null);
    setPhase("checking");
    try {
      await unlockConfidential(pid.trim(), pin);
      setPin("");
      setPhase("granted");
    } catch (err) {
      setPin("");
      setPhase("form");
      setError(
        err instanceof ApiError && err.status === 429
          ? "TOO MANY ATTEMPTS — WAIT A MINUTE"
          : err instanceof ApiError && err.status === 0
            ? err.message
            : "VERIFICATION FAILED",
      );
    }
  }

  return (
    <div className="conf-gate">
      <div className="conf-gate__box">
        <Panel title="Confidential Access" code="CA-AUTH" tools={<StatusDot tone={error ? "crit" : phase === "granted" ? "ok" : "warn"} />}>
          <p className="conf-gate__lead">
            Re-enter <strong>your</strong> project ID and PIN. Confidential mode only opens for the profile you're signed in
            to, and closes automatically after 15 minutes.
          </p>
          <AnimatePresence mode="wait">
            {phase === "granted" ? (
              <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="conf-gate__ok">
                <div className="conf-gate__granted">ACCESS VERIFIED</div>
                <BootSequence lines={VERIFY} stepMs={380} onDone={() => window.setTimeout(() => navigate("/confidential"), 500)} />
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} className="conf-gate__form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} noValidate>
                <TechInput label="Enter confidential project ID" placeholder="000000000000" autoComplete="off" spellCheck={false} value={pid} onChange={(e) => setPid(e.target.value)} />
                <TechInput label="Access PIN" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
                {error && (
                  <motion.div className="conf-gate__err" role="alert" initial={{ x: -6 }} animate={{ x: [0, -4, 4, -2, 0] }}>
                    {error}
                  </motion.div>
                )}
                <TechButton type="submit" block disabled={phase === "checking"}>
                  {phase === "checking" ? "Verifying…" : "Verify"}
                </TechButton>
              </motion.form>
            )}
          </AnimatePresence>
        </Panel>
      </div>
    </div>
  );
}
