import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MathUtils, Quaternion, Vector3, type Group, type Mesh } from "three";
import { Atmosphere, Earth, FallbackEarth, Graticule } from "./Earth";
import { Marker } from "./Marker";
import { latLonToVec3 } from "./geo";

/**
 * Confidential globe: turns the Earth so the owner's stored coordinates face
 * the camera, dollies in, then drops a marker with a scanning pulse and label.
 * With no coordinates it idles and the HUD explains why — nothing is guessed.
 *
 * Steps reported via onStep: 1 globe loaded · 2 rotating · 3 focusing · 4 marker · 5 pulse · 6 label · 7 done
 */
export interface FocusGlobeProps {
  target: { lat: number; lon: number; label: string } | null;
  reducedMotion: boolean;
  onStep?: (step: number) => void;
  onTextureError?: () => void;
}

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

const FAR = 3.3;
const NEAR = 2.05;
const ROTATE_S = 2.4;

function World({ target, reducedMotion, onStep, onTextureError }: FocusGlobeProps) {
  const globe = useRef<Group>(null);
  const earth = useRef<Mesh>(null);
  const { camera } = useThree();
  const [step, setStep] = useState(1);
  const t = useRef(0);
  const from = useRef(new Quaternion());
  const stepRef = useRef(1);

  // Rotation that brings the target point to face +Z (the camera), with north kept up.
  const goal = useMemo(() => {
    if (!target) return null;
    const p = latLonToVec3(target.lat, target.lon, 1).normalize();
    // Yaw so the point's longitude faces the camera, then pitch for latitude.
    const yaw = Math.atan2(p.x, p.z);
    const pitch = Math.asin(MathUtils.clamp(p.y, -1, 1));
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch);
    q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -yaw));
    return q;
  }, [target]);

  const advance = (n: number) => {
    if (stepRef.current >= n) return;
    stepRef.current = n;
    setStep(n);
    onStep?.(n);
  };

  useEffect(() => {
    onStep?.(1);
    if (globe.current) from.current.copy(globe.current.quaternion);
    t.current = 0;
    stepRef.current = 1;
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lon]);

  useFrame((_, dt) => {
    const g = globe.current;
    if (!g) return;
    if (!goal) {
      if (!reducedMotion) g.rotation.y += dt * 0.08; // idle: no location to focus on
      return;
    }
    if (reducedMotion) {
      g.quaternion.copy(goal);
      camera.position.setLength(NEAR);
      advance(7);
      return;
    }
    t.current += dt;
    const k = MathUtils.smootherstep(Math.min(1, t.current / ROTATE_S), 0, 1);
    if (stepRef.current < 4) {
      advance(2);
      g.quaternion.slerpQuaternions(from.current, goal, k);
      if (k > 0.55) advance(3);
      camera.position.setLength(MathUtils.lerp(FAR, NEAR, MathUtils.smootherstep(Math.max(0, (k - 0.35) / 0.65), 0, 1)));
      if (k >= 1) advance(4);
    } else {
      if (t.current > ROTATE_S + 0.5) advance(5);
      if (t.current > ROTATE_S + 1.1) advance(6);
      if (t.current > ROTATE_S + 1.6) advance(7);
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[-3, 2, 4]} intensity={1.6} color="#cfefff" />
      <Stars radius={60} depth={30} count={1200} factor={2} saturation={0} fade speed={reducedMotion ? 0 : 0.3} />
      <group ref={globe}>
        <TextureBoundary fallback={<FallbackEarth ref={earth} />} onError={onTextureError}>
          <Suspense fallback={<FallbackEarth ref={earth} />}>
            <Earth ref={earth} />
          </Suspense>
        </TextureBoundary>
        <Graticule />
        <Atmosphere />
        {target && step >= 4 && (
          <Marker
            loc={{ id: "SUBJECT", label: target.label, lat: target.lat, lon: target.lon }}
            color="#ff304f"
            active={step >= 5}
            showLabel={step >= 6}
            animate={!reducedMotion}
            occluder={earth}
          />
        )}
      </group>
      <OrbitControls enabled={!target || step >= 7} enablePan={false} minDistance={1.5} maxDistance={4.2} enableDamping rotateSpeed={0.5} />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.2} intensity={0.9} />
      </EffectComposer>
    </>
  );
}

export default function FocusGlobeScene(props: FocusGlobeProps) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, FAR], fov: 38, near: 0.1, far: 200 }} gl={{ antialias: true, alpha: true }}>
      <World {...props} />
    </Canvas>
  );
}
