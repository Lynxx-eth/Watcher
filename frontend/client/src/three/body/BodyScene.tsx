import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MathUtils, type Group, type IUniform } from "three";
import { createSharedUniforms } from "./holoMaterial";
import { ProceduralBody } from "./ProceduralBody";
import { GlbBody } from "./GlbBody";
import { ScanPlatform } from "./ScanPlatform";
import { REGIONS, type RegionId } from "./regions";

/**
 * Load sequence stages (driven by the parent so the HTML HUD stays in sync):
 * 0 dark · 1 initialising · 2 platform online · 3 materialising · 4 illuminated · 5 panels · 6 scan initialised
 */
export interface BodySceneProps {
  stage: number;
  reducedMotion: boolean;
  useGlb: boolean;
  selected: RegionId | null;
  onSelect: (r: RegionId | null) => void;
  onHover?: (r: RegionId | null) => void;
  /** Stop rendering (e.g. while the brain view is in front) without losing state. */
  paused?: boolean;
}

const REVEAL_SECONDS = 2.6;
const TOP = 1.86;

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Rig({ stage, reducedMotion, useGlb, selected, onSelect, onHover }: BodySceneProps) {
  const shared = useMemo(createSharedUniforms, []);
  const highlights = useMemo(
    () => Object.fromEntries(REGIONS.map((r) => [r.id, { value: 0 }])) as Record<RegionId, IUniform<number>>,
    [],
  );
  const glbHighlight = useMemo<IUniform<number>>(() => ({ value: 0 }), []);
  const power = useRef(0);
  const scanY = useRef(0);
  const revealT = useRef(0);
  const spin = useRef<Group>(null);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const [dragging, setDragging] = useState(false);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    shared.uTime.value = t;

    if (reducedMotion) {
      power.current = stage >= 2 ? 1 : 0;
      shared.uReveal.value = stage >= 3 ? TOP + 0.2 : -0.1;
      shared.uGlow.value = stage >= 4 ? 1 : stage >= 3 ? 0.6 : 0;
      shared.uScanY.value = -1; // no moving band
      scanY.current = -1;
    } else {
      power.current = MathUtils.damp(power.current, stage >= 2 ? 1 : 0, 2.2, dt);
      if (stage >= 3) revealT.current = Math.min(1, revealT.current + dt / REVEAL_SECONDS);
      shared.uReveal.value = stage >= 3 ? -0.05 + revealT.current * (TOP + 0.25) : -0.1;
      shared.uGlow.value = MathUtils.damp(shared.uGlow.value, stage >= 4 ? 1 : stage >= 3 ? 0.55 : 0, 2.5, dt);
      // Scan band: rides the materialise edge, then sweeps up and down.
      scanY.current =
        stage < 3 ? -1 : revealT.current < 1 ? shared.uReveal.value : 0.95 + Math.sin(t * 0.55) * 0.9;
      shared.uScanY.value = scanY.current;
      if (spin.current && stage >= 4 && !dragging && !selected) spin.current.rotation.y += dt * 0.18;
    }

    for (const r of REGIONS) {
      const target = r.id === selected || r.id === hovered ? 1 : 0;
      highlights[r.id].value = MathUtils.damp(highlights[r.id].value, target, 8, dt);
    }
    glbHighlight.value = MathUtils.damp(glbHighlight.value, hovered || selected ? 1 : 0, 8, dt);
  });

  const hover = (r: RegionId | null) => {
    setHovered(r);
    onHover?.(r);
  };
  const interactive = stage >= 4;
  const procedural = (
    <ProceduralBody shared={shared} highlights={highlights} onHover={interactive ? hover : () => undefined} onSelect={interactive ? onSelect : () => undefined} />
  );

  return (
    <>
      <ScanPlatform power={power} scanY={scanY} animate={!reducedMotion} />
      <group ref={spin}>
        {useGlb ? (
          <ModelBoundary fallback={procedural}>
            <Suspense fallback={null}>
              <GlbBody shared={shared} highlight={glbHighlight} onHover={interactive ? hover : () => undefined} onSelect={interactive ? onSelect : () => undefined} />
            </Suspense>
          </ModelBoundary>
        ) : (
          procedural
        )}
      </group>

      {/* Coordinate indicators (fixed in space while the figure turns) */}
      {stage >= 5 &&
        REGIONS.map((r) => (
          <Html key={r.id} position={r.anchor} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div className={`scan-coord${r.id === selected || r.id === hovered ? " is-on" : ""}`}>
              <span>{r.anchor[1].toFixed(2)}</span>
              <small>{r.label}</small>
            </div>
          </Html>
        ))}

      <OrbitControls
        target={[0, 0.95, 0]}
        enablePan={false}
        minDistance={1.6}
        maxDistance={5}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.62}
        enableDamping
        onStart={() => setDragging(true)}
        onEnd={() => setDragging(false)}
      />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.25} luminanceSmoothing={0.3} intensity={1.15} />
      </EffectComposer>
    </>
  );
}

export default function BodyScene(props: BodySceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.25, 3.4], fov: 38, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
      frameloop={props.paused ? "never" : "always"}
    >
      <Rig {...props} />
    </Canvas>
  );
}
