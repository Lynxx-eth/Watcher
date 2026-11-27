import { Suspense, lazy, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Chip, Panel, useReducedMotion } from "@watcher/ui";
import type { ConfidentialProfile } from "@watcher/shared/types";
import { fmtCoord } from "../../three/globe/geo";

const FocusGlobeScene = lazy(() => import("../../three/globe/FocusGlobeScene"));

const STEP_TEXT: Record<number, string> = {
  1: "Globe online",
  2: "Rotating to supplied coordinates",
  3: "Focusing",
  4: "Marker placed",
  5: "Scanning pulse active",
  6: "Location label set",
  7: "Address locked",
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function LocationGlobePanel({ location, onStep }: { location: ConfidentialProfile["location"]; onStep?: (s: number, text: string) => void }) {
  const reduced = useReducedMotion();
  const webgl = useMemo(hasWebGL, []);
  const [step, setStep] = useState(0);
  const [noTextures, setNoTextures] = useState(false);

  const geo = location?.geo ?? null;
  const precision = geo?.source.split(":")[1] ?? null;
  const target = useMemo(
    () => (geo ? { lat: geo.lat, lon: geo.lon, label: [location?.city, location?.country].filter(Boolean).join(", ") } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo?.lat, geo?.lon, location?.city, location?.country],
  );

  return (
    <Panel title="Location Analysis" code="CF-GEO" flush>
      <div className="lglobe">
        {webgl ? (
          <Suspense fallback={<div className="lglobe__msg w-label">Loading globe…</div>}>
            <FocusGlobeScene
              target={target}
              reducedMotion={reduced}
              onTextureError={() => setNoTextures(true)}
              onStep={(s) => {
                setStep(s);
                onStep?.(s, STEP_TEXT[s]);
              }}
            />
          </Suspense>
        ) : (
          <div className="lglobe__msg w-c-warn">WebGL unavailable — globe disabled.</div>
        )}

        <div className="lglobe__hud">
          {geo ? (
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-label">
                {STEP_TEXT[step] ?? ""}
              </motion.div>
            </AnimatePresence>
          ) : location?.geoStatus === "UNAVAILABLE" ? (
            <Chip tone="warn">Location unavailable</Chip>
          ) : (
            <Chip tone="info">Resolving coordinates…</Chip>
          )}
        </div>

        {geo && step >= 6 && (
          <motion.div className="lglobe__tag" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <span className="w-label">Supplied address · {precision ? `${precision}-level` : "located"}</span>
            <span className="w-mono-num">{fmtCoord(geo.lat, geo.lon)}</span>
          </motion.div>
        )}

        {!geo && location?.geoStatus === "UNAVAILABLE" && (
          <p className="lglobe__note">The address on file couldn't be matched by the geocoder, so no position is shown.</p>
        )}
        {noTextures && <p className="lglobe__note w-c-warn">Earth textures not installed — run npm run fetch:textures</p>}
      </div>
    </Panel>
  );
}
