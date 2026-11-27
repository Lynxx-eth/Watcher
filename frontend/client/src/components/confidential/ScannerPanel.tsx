import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Panel, TechButton, useReducedMotion } from "@watcher/ui";
import { BootSequence, type BootLine } from "../effects/BootSequence";
import { REGION_BY_ID, type RegionId } from "../../three/body/regions";
import { BRAIN_REGIONS, type BrainRegionId } from "../../three/brain/brainGeometry";
import { BODY_MODEL_URL } from "../../three/body/GlbBody";
import "./ScannerPanel.css";

const BodyScene = lazy(() => import("../../three/body/BodyScene"));
const BrainScene = lazy(() => import("../../three/brain/BrainScene"));

const INIT: BootLine[] = [
  { text: "Initialising holographic projector" },
  { text: "Calibrating scan platform", tone: "ok" },
  { text: "Loading subject mesh", tone: "ok" },
];

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Uses public/models/human.glb if present (and really a GLB), else the procedural figure. */
function useGlbAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    fetch(BODY_MODEL_URL, { method: "HEAD" })
      .then((r) => setOk(r.ok && (r.headers.get("content-type") ?? "").includes("gltf")))
      .catch(() => setOk(false));
  }, []);
  return ok;
}

export interface ScannerPanelProps {
  stage: number;
  selected: RegionId | null;
  onSelect: (r: RegionId | null) => void;
  mode: "body" | "brain";
  brainRegion: BrainRegionId | null;
  onBrainRegion: (r: BrainRegionId | null) => void;
  onBack: () => void;
}

export function ScannerPanel({ stage, selected, onSelect, mode, brainRegion, onBrainRegion, onBack }: ScannerPanelProps) {
  const [brainHover, setBrainHover] = useState<BrainRegionId | null>(null);
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const glb = useGlbAvailable();
  const [bannerGone, setBannerGone] = useState(false);

  useEffect(() => {
    if (stage < 6) return;
    const id = window.setTimeout(() => setBannerGone(true), 2600);
    return () => window.clearTimeout(id);
  }, [stage]);

  const region = selected ? REGION_BY_ID[selected] : null;
  const brain = mode === "brain";
  const shownBrainRegion = BRAIN_REGIONS.find((r) => r.id === (brainRegion ?? brainHover)) ?? null;

  return (
    <Panel title={brain ? "Neural Visualisation" : "Holographic Scanner"} code={brain ? "CF-NEU" : "CF-SCAN"} flush>
      <div className={`scanner${stage === 0 ? " is-dark" : ""}`}>
        {webgl ? (
          <>
            {/* Body stays mounted (paused) so returning doesn't replay the materialise sequence. */}
            <motion.div
              className="scanner__layer"
              animate={brain ? { opacity: 0, scale: 1.25 } : { opacity: 1, scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ pointerEvents: brain ? "none" : "auto" }}
              aria-hidden={brain}
            >
              <Suspense fallback={<div className="scanner__center w-label">Loading projector…</div>}>
                <BodyScene stage={stage} reducedMotion={reduced} useGlb={glb} selected={selected} onSelect={onSelect} paused={brain} />
              </Suspense>
            </motion.div>
            <AnimatePresence>
              {brain && (
                <motion.div
                  className="scanner__layer"
                  initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Suspense fallback={<div className="scanner__center w-label">Loading neural model…</div>}>
                    <BrainScene reducedMotion={reduced} active={brainRegion} onHover={setBrainHover} onSelect={onBrainRegion} />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="scanner__center w-c-warn">WebGL is unavailable in this browser — 3D scanner disabled.</div>
        )}

        {/* Scanning brackets */}
        <span className="scanner__br scanner__br--tl" aria-hidden />
        <span className="scanner__br scanner__br--tr" aria-hidden />
        <span className="scanner__br scanner__br--bl" aria-hidden />
        <span className="scanner__br scanner__br--br" aria-hidden />

        <AnimatePresence>
          {stage >= 1 && stage < 4 && (
            <motion.div className="scanner__init" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BootSequence lines={INIT} stepMs={reduced ? 0 : 650} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {stage >= 6 && !bannerGone && !brain && (
            <motion.div
              className="scanner__banner"
              initial={reduced ? false : { opacity: 0, scale: 1.08, letterSpacing: "0.6em" }}
              animate={{ opacity: 1, scale: 1, letterSpacing: "0.3em" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              SCAN INITIALIZED
            </motion.div>
          )}
        </AnimatePresence>

        {stage >= 6 && !brain && (
          <div className="scanner__status w-label">
            <span className="scanner__dot" /> {bannerGone ? "Scan active · simulation" : ""}
            <span className="scanner__src">{glb ? "Model: GLB" : "Model: procedural"}</span>
          </div>
        )}

        {brain && (
          <div className="scanner__brainhud">
            <TechButton size="sm" onClick={onBack}>
              ← Back to full body
            </TechButton>
            <ul className="scanner__lobes" aria-label="Brain regions">
              {BRAIN_REGIONS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={r.id === brainRegion ? "is-on" : r.id === brainHover ? "is-hover" : ""}
                    onClick={() => onBrainRegion(r.id === brainRegion ? null : r.id)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AnimatePresence>
          {brain && shownBrainRegion && (
            <motion.div
              key={`b-${shownBrainRegion.id}`}
              className="scanner__region"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
            >
              <div className="scanner__region-head">
                <strong>{shownBrainRegion.label}</strong>
              </div>
              <p className="scanner__note" style={{ marginTop: 0 }}>{shownBrainRegion.note}</p>
              <div className="w-rows">
                <div className="w-rows__k">State</div>
                <div className="w-rows__v w-c-ok">{brainRegion === shownBrainRegion.id ? "Highlighted" : "Hover"}</div>
                <div className="w-rows__k">Activity</div>
                <div className="w-rows__v">Visual simulation only</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!brain && region && (
            <motion.div
              key={region.id}
              className="scanner__region"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              <div className="scanner__region-head">
                <strong>{region.label}</strong>
                <TechButton size="sm" variant="ghost" onClick={() => onSelect(null)} aria-label="Clear selection">
                  ✕
                </TechButton>
              </div>
              <div className="w-rows">
                <div className="w-rows__k">Region</div>
                <div className="w-rows__v">{region.id.toUpperCase()}</div>
                <div className="w-rows__k">Height</div>
                <div className="w-rows__v w-mono-num">Y {region.anchor[1].toFixed(2)}</div>
                <div className="w-rows__k">Status</div>
                <div className="w-rows__v w-c-ok">Scanned · simulated</div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {stage >= 5 && (
          <div className="scanner__hint w-label">
            {brain
              ? "Drag to rotate · scroll to zoom · click a lobe · not a medical measurement"
              : "Drag to rotate · scroll to zoom · click a body region · click the head for neural view"}
          </div>
        )}
      </div>
    </Panel>
  );
}
