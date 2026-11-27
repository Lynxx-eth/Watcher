import { Component, Suspense, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { Group, Mesh } from "three";
import { Arc, Marker } from "./Marker";
import { Atmosphere, Earth, FallbackEarth, Graticule } from "./Earth";
import type { GlobeLocation } from "./geo";

export interface GlobeSceneProps {
  locations: GlobeLocation[];
  activeId: string | null;
  previousId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reducedMotion: boolean;
  /** Called once if the Earth textures can't be loaded. */
  onTextureError?: () => void;
}

/** If texture loading throws, fall back to the plain sphere instead of crashing the panel. */
class TextureBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function World({ locations, activeId, previousId, selectedId, onSelect, reducedMotion, onTextureError }: GlobeSceneProps) {
  const spin = useRef<Group>(null);
  const earth = useRef<Mesh>(null);
  const [dragging, setDragging] = useState(false);

  useFrame((_, dt) => {
    if (spin.current && !reducedMotion && !dragging && !selectedId) spin.current.rotation.y += dt * 0.06;
  });

  const active = locations.find((l) => l.id === activeId) ?? null;
  const previous = locations.find((l) => l.id === previousId) ?? null;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} color="#cfefff" />
      <Stars radius={60} depth={30} count={1500} factor={2.2} saturation={0} fade speed={reducedMotion ? 0 : 0.4} />

      <group ref={spin} rotation={[0.35, -1.2, 0]}>
        <TextureBoundary fallback={<FallbackEarth ref={earth} />} onError={onTextureError}>
          <Suspense fallback={<FallbackEarth ref={earth} />}>
            <Earth ref={earth} />
          </Suspense>
        </TextureBoundary>
        <Graticule />
        <Atmosphere />

        {locations.map((l) => (
          <Marker
            key={l.id}
            loc={l}
            active={l.id === activeId}
            selected={l.id === selectedId}
            showLabel={l.id === activeId}
            color={l.id === activeId ? "#ff304f" : "#00e5ff"}
            animate={!reducedMotion}
            occluder={earth}
            onSelect={onSelect}
          />
        ))}

        {active && previous && previous.id !== active.id && (
          <Arc key={`${previous.id}-${active.id}`} from={previous} to={active} animate={!reducedMotion} />
        )}
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={4.5}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        enableDamping
        onStart={() => setDragging(true)}
        onEnd={() => setDragging(false)}
      />

      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.2} intensity={0.9} />
      </EffectComposer>
    </>
  );
}

/** Default export so it can be code-split with React.lazy. */
export default function GlobeScene(props: GlobeSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3], fov: 38, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect(null)}
      frameloop={props.reducedMotion ? "demand" : "always"}
    >
      <World {...props} />
    </Canvas>
  );
}
