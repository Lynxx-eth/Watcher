import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Chip, Panel, TechButton, useReducedMotion } from "@watcher/ui";
import { DEMO_LOCATIONS, fmtCoord } from "../../three/globe/geo";

// three.js + R3F are only downloaded when a globe is on screen.
const GlobeScene = lazy(() => import("../../three/globe/GlobeScene"));

const CYCLE_MS = 5000;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GlobePanel({ subjectLabel }: { subjectLabel: string }) {
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texturesMissing, setTexturesMissing] = useState(false);

  // Every 5 s move to the next simulated node (paused while inspecting a marker).
  useEffect(() => {
    if (selectedId || reduced) return;
    const id = window.setInterval(() => setStep((s) => s + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [selectedId, reduced]);

  const n = DEMO_LOCATIONS.length;
  const active = DEMO_LOCATIONS[step % n];
  const previous = step > 0 ? DEMO_LOCATIONS[(step - 1) % n] : null;
  const selected = DEMO_LOCATIONS.find((l) => l.id === selectedId) ?? null;

  return (
    <Panel title="Global Intelligence View" code="GEO-04" flush>
      <div className="globe">
        {webgl ? (
          <Suspense fallback={<div className="globe__loading w-label">Initialising orbital render…</div>}>
            <GlobeScene
              locations={DEMO_LOCATIONS}
              activeId={active.id}
              previousId={previous?.id ?? null}
              selectedId={selectedId}
              onSelect={setSelectedId}
              reducedMotion={reduced}
              onTextureError={() => setTexturesMissing(true)}
            />
          </Suspense>
        ) : (
          <div className="globe__loading w-c-warn">WebGL is unavailable in this browser — 3D globe disabled.</div>
        )}

        <div className="globe__hud globe__hud--tl">
          <Chip tone="warn">Simulated feed</Chip>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              className="globe__target"
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.35 }}
            >
              <span className="w-label">Scanning</span>
              <strong>{active.id}</strong>
              <span>{active.label}</span>
              <span className="w-c-muted w-mono-num">{fmtCoord(active.lat, active.lon)}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div
              className="globe__inspect"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              <div className="globe__inspect-head">
                <strong>{selected.id}</strong>
                <TechButton variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label="Close marker details">
                  ✕
                </TechButton>
              </div>
              <div className="w-rows">
                <div className="w-rows__k">Node</div>
                <div className="w-rows__v">{selected.label}</div>
                <div className="w-rows__k">Coords</div>
                <div className="w-rows__v w-mono-num">{fmtCoord(selected.lat, selected.lon)}</div>
                <div className="w-rows__k">Type</div>
                <div className="w-rows__v w-c-warn">Simulated demo node</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="globe__hud globe__hud--br">
          <div className="globe__subject">
            <span className="w-label">Subject location</span>
            <span>{subjectLabel}</span>
          </div>
        </div>

        {texturesMissing && (
          <div className="globe__hud globe__hud--bl w-c-warn">
            Earth textures not installed — run <code>npm run fetch:textures</code>
          </div>
        )}

        <div className="globe__hint w-label">Drag to rotate · scroll to zoom · click a node</div>
      </div>
    </Panel>
  );
}
