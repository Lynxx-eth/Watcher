import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import type { ConfidentialProfile } from "@watcher/shared/types";
import {
  Backdrop,
  bioTone,
  Chip,
  DataRows,
  FictionBanner,
  fmtDob,
  LogoMark,
  Panel,
  TechButton,
  threatTone,
  toneVar,
  useClock,
  useReducedMotion,
} from "@watcher/ui";
import { ApiError, fetchConfidentialProfile, lockConfidential } from "../services/api";
import { SubjectPhoto } from "../components/dashboard/SubjectPhoto";
import { ScannerPanel } from "../components/confidential/ScannerPanel";
import type { RegionId } from "../three/body/regions";
import { BRAIN_REGIONS, type BrainRegionId } from "../three/brain/brainGeometry";
import { NeuralWaveform } from "../components/confidential/NeuralWaveform";
import { LocationGlobePanel } from "../components/confidential/LocationGlobePanel";
import "./ConfidentialPage.css";

interface LogLine {
  at: string;
  text: string;
  tone?: "ok" | "warn";
}

const stamp = () => new Date().toISOString().slice(11, 19);

function useCountdown(expiresAt: string | null) {
  // null until the first tick, so a fresh page isn't mistaken for an expired one.
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return left;
}

export function ConfidentialPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { time } = useClock();
  const [p, setP] = useState<ConfidentialProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const left = useCountdown(p?.expiresAt ?? null);
  const [stage, setStage] = useState(0);
  const [region, setRegion] = useState<RegionId | null>(null);
  const [mode, setMode] = useState<"body" | "brain">("body");
  const [brainRegion, setBrainRegion] = useState<BrainRegionId | null>(null);

  // Selecting the head opens the neural view.
  const selectRegion = useCallback((r: RegionId | null) => {
    setRegion(r);
    if (r === "head") setMode("brain");
  }, []);
  const backToBody = useCallback(() => {
    setMode("body");
    setBrainRegion(null);
    setRegion(null);
  }, []);

  const push = useCallback((text: string, tone?: LogLine["tone"]) => setLog((l) => [{ at: stamp(), text, tone }, ...l].slice(0, 40)), []);

  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return; // load once, even if navigate's identity changes
    loaded.current = true;
    push("Confidential channel opened");
    fetchConfidentialProfile()
      .then((data) => {
        setP(data);
        push(`Record ${data.projectId} decrypted`, "ok");
        push(
          data.location?.geoStatus === "LOCATED"
            ? "Geographic coordinates on file"
            : "Address on file · coordinates not yet resolved",
          data.location?.geoStatus === "LOCATED" ? "ok" : "warn",
        );
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
          navigate("/console/confidential", { replace: true });
          return;
        }
        setError(e instanceof ApiError ? e.message : "LOAD FAILED");
      });
  }, [navigate, push]);

  // Cinematic load: dark → init → platform → materialise → illuminate → panels → SCAN INITIALIZED.
  useEffect(() => {
    if (!p) return;
    if (reduced) {
      setStage(6);
      return;
    }
    const steps = [700, 1700, 1300, 2700, 900, 900];
    const timers: number[] = [];
    let acc = 0;
    steps.forEach((ms, i) => {
      acc += ms;
      timers.push(window.setTimeout(() => setStage(i + 1), acc));
    });
    return () => timers.forEach(window.clearTimeout);
  }, [p, reduced]);

  useEffect(() => {
    if (stage === 2) push("Scan platform online", "ok");
    if (stage === 3) push("Materialising subject mesh");
    if (stage === 6) push("SCAN INITIALIZED", "ok");
  }, [stage, push]);

  useEffect(() => {
    if (region) push(`Region selected: ${region.toUpperCase()}`);
  }, [region, push]);

  useEffect(() => {
    if (mode === "brain") push("Neural visualisation engaged", "ok");
  }, [mode, push]);

  const brainLabel = BRAIN_REGIONS.find((r) => r.id === brainRegion)?.label ?? null;
  useEffect(() => {
    if (brainLabel) push(`Neural region: ${brainLabel}`);
  }, [brainLabel, push]);

  // Geocoding runs in the background after enrolment; re-check a few times while it's pending.
  useEffect(() => {
    if (p?.location?.geoStatus !== "PENDING") return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      fetchConfidentialProfile()
        .then((d) => {
          if (d.location?.geoStatus !== "PENDING") {
            setP(d);
            push(d.location?.geoStatus === "LOCATED" ? "Coordinates resolved" : "Location unavailable", d.location?.geoStatus === "LOCATED" ? "ok" : "warn");
          }
        })
        .catch(() => undefined);
      if (tries >= 6) window.clearInterval(id);
    }, 5000);
    return () => window.clearInterval(id);
  }, [p?.location?.geoStatus, push]);

  // Close the environment when the server-side window ends.
  useEffect(() => {
    if (p && left === 0) {
      void lockConfidential()
        .catch(() => undefined)
        .finally(() => navigate("/console/confidential", { replace: true }));
    }
  }, [left, p, navigate]);

  async function lockNow() {
    await lockConfidential().catch(() => undefined);
    navigate("/console", { replace: true });
  }

  const secs = left ?? 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  // Side panels load at stage 5, after the body has materialised.
  const panelsIn = stage >= 5;
  const enter = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: panelsIn ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
          transition: { delay: 0.12 * i, type: "spring" as const, stiffness: 140, damping: 22 },
        };

  return (
    <div className="conf">
      <Backdrop />
      <FictionBanner />

      <header className="conf__bar">
        <span className="conf__brand">
          <LogoMark size={26} /> WATCHER <span className="w-c-crit">CONFIDENTIAL</span>
        </span>
        <span className="w-label">{p ? `${p.projectId} · ${p.classification}` : "—"}</span>
        <span className={`conf__timer${left !== null && left < 60 ? " is-low" : ""}`} aria-live="polite">
          SESSION {mm}:{ss}
        </span>
        <span className="w-label w-mono-num">{time}</span>
        <Link to="/console" className="w-label">
          ← Console
        </Link>
        <TechButton size="sm" variant="danger" onClick={() => void lockNow()}>
          Lock
        </TechButton>
      </header>

      {error && <p className="w-c-crit" style={{ padding: 16, position: "relative" }}>{error}</p>}

      {p && (
        <main className="conf__grid">
          <motion.div className="conf__left" {...enter(1)}>
            <Panel title="Subject Profile" code="CF-01">
              <div className="conf__photo">
                <SubjectPhoto url={p.photoUrl} name={p.fullName} variant="scan" />
              </div>
              <DataRows
                rows={[
                  { k: "Full name", v: <strong>{p.fullName}</strong> },
                  { k: "Date of birth", v: fmtDob(p.dateOfBirth) },
                  { k: "Nationality", v: p.nationality || "—" },
                  { k: "Project ID", v: <span className="w-c-crit">{p.projectId}</span> },
                  { k: "Classification", v: p.classification },
                  { k: "Threat", v: <Chip tone={threatTone(p.threatLevel)}>{p.threatLevel}</Chip> },
                ]}
              />
            </Panel>
          </motion.div>

          <div className="conf__center">
            <ScannerPanel
              stage={stage}
              selected={region}
              onSelect={selectRegion}
              mode={mode}
              brainRegion={brainRegion}
              onBrainRegion={setBrainRegion}
              onBack={backToBody}
            />
          </div>

          <motion.div className="conf__right" {...enter(2)}>
            <LocationGlobePanel location={p.location} onStep={(s, text) => (s === 2 || s === 4 || s === 7) && push(text, s === 7 ? "ok" : undefined)} />
            <Panel title="Supplied Address" code="CF-ADR">
              <DataRows
                rows={[
                  { k: "Address", v: p.location?.address ?? "Not provided" },
                  { k: "City", v: p.location ? [p.location.city, p.location.region].filter(Boolean).join(", ") : "—" },
                  { k: "Country", v: p.location?.country ?? "—" },
                  {
                    k: "Coordinates",
                    v:
                      p.location?.geo ? (
                        `${p.location.geo.lat.toFixed(4)}, ${p.location.geo.lon.toFixed(4)}`
                      ) : (
                        <span className="w-c-warn">{p.location?.geoStatus === "UNAVAILABLE" ? "Location unavailable" : "Resolving…"}</span>
                      ),
                  },
                ]}
              />
              <p className="panel-foot">The address you entered — not live tracking or proof of whereabouts.</p>
            </Panel>
            <Panel title="Biometric Records" code="CF-BIO">
              <DataRows
                rows={(["facial", "fingerprint", "iris", "dna"] as const).map((k) => ({
                  k,
                  v: p.biometrics ? <span style={{ color: toneVar[bioTone(p.biometrics[k])] }}>{p.biometrics[k]}</span> : "—",
                }))}
              />
            </Panel>
          </motion.div>

          <motion.div className="conf__bottom" {...enter(3)}>
            <Panel title={`Neural Activity${brainLabel ? ` — ${brainLabel}` : ""}`} code="CF-NRL">
              <NeuralWaveform focus={brainLabel} />
            </Panel>
            <Panel title="System Diagnostics" code="CF-SYS">
              <DataRows
                rows={[
                  { k: "Channel", v: <span className="w-c-ok">ENCRYPTED (TLS)</span> },
                  { k: "Verification", v: <span className="w-c-ok">ID + PIN</span> },
                  { k: "Auto-lock", v: `${mm}:${ss}` },
                  { k: "Render", v: "Simulation" },
                ]}
              />
            </Panel>
            <Panel title="Processing Log" code="CF-LOG">
              <div className="w-term conf__log">
                {log.map((l, i) => (
                  <div key={i}>
                    <span className="w-c-muted">{l.at}</span>{" "}
                    <span className={l.tone === "ok" ? "w-term__ok" : l.tone === "warn" ? "w-term__warn" : undefined}>{l.text}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </motion.div>
        </main>
      )}
    </div>
  );
}
