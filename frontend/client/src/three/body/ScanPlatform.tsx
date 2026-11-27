import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Object3D,
  ShaderMaterial,
  Vector3,
  type Group,
  type InstancedMesh,
  type MeshBasicMaterial,
} from "three";

const CYAN = "#00e5ff";
const BLUE = "#00bfff";

/** 0 → hidden, 1 → fully active. Everything in the platform fades with it. */
export interface PlatformProps {
  power: { current: number };
  scanY: { current: number };
  animate: boolean;
}

/** Concentric rotating rings, segmented arcs and tick marks at floor level. */
function Rings({ power, animate }: Omit<PlatformProps, "scanY">) {
  const a = useRef<Group>(null);
  const b = useRef<Group>(null);
  const c = useRef<Group>(null);
  const ticks = useRef<InstancedMesh>(null);
  // Every platform material registers itself with its peak opacity; all fade with `power`.
  const mats = useRef(new Set<MeshBasicMaterial>());
  const reg = (max: number) => (m: MeshBasicMaterial | null) => {
    if (m) {
      m.userData.max = max;
      mats.current.add(m);
    }
  };

  useEffect(() => {
    const t = ticks.current;
    if (!t) return;
    const o = new Object3D();
    for (let i = 0; i < 96; i++) {
      const ang = (i / 96) * Math.PI * 2;
      o.position.set(Math.cos(ang) * 0.98, 0.002, Math.sin(ang) * 0.98);
      o.rotation.set(-Math.PI / 2, 0, -ang);
      o.scale.set(1, i % 8 === 0 ? 2.4 : 1, 1);
      o.updateMatrix();
      t.setMatrixAt(i, o.matrix);
    }
    t.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    mats.current.forEach((m) => (m.opacity = (m.userData.max as number) * power.current));
    if (!animate) return;
    if (a.current) a.current.rotation.y += dt * 0.25;
    if (b.current) b.current.rotation.y -= dt * 0.4;
    if (c.current) c.current.rotation.y += dt * 0.12;
  });

  const ring = (inner: number, outer: number, max: number, theta = Math.PI * 2, start = 0, color = CYAN) => (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[inner, outer, 128, 1, start, theta]} />
      <meshBasicMaterial ref={reg(max)} color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  );

  return (
    <group>
      {/* soft base disc */}
      {ring(0, 0.9, 0.22, Math.PI * 2, 0, "#0a4a7a")}
      {ring(0.88, 0.9, 0.85)}
      <group ref={a}>
        {[0, 1, 2, 3].map((k) => (
          <group key={k}>{ring(0.7, 0.735, 0.5, Math.PI / 3, (k * Math.PI) / 2, BLUE)}</group>
        ))}
      </group>
      <group ref={b}>
        {ring(0.5, 0.507, 0.7)}
        {[0, 1, 2].map((k) => (
          <group key={k}>{ring(0.54, 0.575, 0.35, Math.PI / 5, (k * Math.PI * 2) / 3)}</group>
        ))}
      </group>
      <group ref={c}>{ring(1.08, 1.09, 0.6, Math.PI * 1.6, 0, BLUE)}</group>
      <instancedMesh ref={ticks} args={[undefined, undefined, 96]}>
        <planeGeometry args={[0.006, 0.05]} />
        <meshBasicMaterial ref={reg(0.6)} color={CYAN} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const COLUMN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const COLUMN_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uPower; uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 2.2);
    float shimmer = 0.75 + 0.25 * sin(uTime * 2.0 + vUv.x * 40.0);
    float a = fade * shimmer * 0.35 * uPower;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** Vertical light columns rising from the platform edge. */
function LightColumns({ power, animate }: Omit<PlatformProps, "scanY">) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: COLUMN_VERT,
        fragmentShader: COLUMN_FRAG,
        uniforms: { uColor: { value: new Color(BLUE) }, uPower: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    mat.uniforms.uPower.value = power.current;
    if (animate) mat.uniforms.uTime.value += dt;
  });
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.78, 0.9, Math.sin(a) * 0.78]} material={mat}>
            <cylinderGeometry args={[0.05, 0.08, 1.8, 16, 1, true]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Horizontal scan ring that sweeps up and down the body. */
function ScanBeam({ power, scanY }: Pick<PlatformProps, "power" | "scanY">) {
  const g = useRef<Group>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const discMat = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (g.current) g.current.position.y = scanY.current;
    if (ringMat.current) ringMat.current.opacity = 0.9 * power.current;
    if (discMat.current) discMat.current.opacity = 0.08 * power.current;
  });
  return (
    <group ref={g}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.435, 96]} />
        <meshBasicMaterial ref={ringMat} color={CYAN} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 64]} />
        <meshBasicMaterial ref={discMat} color={CYAN} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

const PARTICLE_VERT = /* glsl */ `
  uniform float uTime; uniform float uPower;
  attribute float aSpeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * aSpeed, 2.2);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.0 + aSpeed * 18.0) * (3.0 / -mv.z);
    vAlpha = uPower * (1.0 - p.y / 2.2);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** Floating technical particles drifting upward around the subject. */
function Particles({ power, animate }: Omit<PlatformProps, "scanY">) {
  const { geometry, material } = useMemo(() => {
    const n = 500;
    const pos = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 0.25 + Math.random() * 0.95;
      const a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, Math.random() * 2.2, Math.sin(a) * r], i * 3);
      speed[i] = 0.03 + Math.random() * 0.12;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("aSpeed", new BufferAttribute(speed, 1));
    const material = new ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new Color(CYAN) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geometry, material };
  }, []);
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
  useFrame((_, dt) => {
    material.uniforms.uPower.value = power.current;
    if (animate) material.uniforms.uTime.value += dt;
  });
  return <points geometry={geometry} material={material} />;
}

/** Dashed elliptical orbits around the figure (as in the reference). */
function Orbits({ animate }: { animate: boolean }) {
  const g = useRef<Group>(null);
  const curves = useMemo(
    () =>
      [
        { rx: 1.15, ry: 0.42, tilt: [0.35, 0, 0.5] },
        { rx: 1.05, ry: 0.36, tilt: [-0.3, 0.6, -0.45] },
        { rx: 0.95, ry: 0.3, tilt: [1.2, 0, 0.1] },
      ].map(({ rx, ry, tilt }) => ({
        tilt: tilt as [number, number, number],
        pts: Array.from({ length: 129 }, (_, i) => {
          const t = (i / 128) * Math.PI * 2;
          return new Vector3(Math.cos(t) * rx, 0, Math.sin(t) * ry);
        }),
      })),
    [],
  );
  useFrame((_, dt) => {
    if (animate && g.current) g.current.rotation.y += dt * 0.05;
  });
  return (
    <group ref={g} position={[0, 1.0, 0]}>
      {curves.map((c, i) => (
        <group key={i} rotation={c.tilt}>
          <Line points={c.pts} color={BLUE} lineWidth={0.8} dashed dashSize={0.03} gapSize={0.03} transparent opacity={0.35} toneMapped={false} />
        </group>
      ))}
    </group>
  );
}

export function ScanPlatform(props: PlatformProps) {
  return (
    <group>
      <Rings power={props.power} animate={props.animate} />
      <LightColumns power={props.power} animate={props.animate} />
      <ScanBeam power={props.power} scanY={props.scanY} />
      <Particles power={props.power} animate={props.animate} />
      <Orbits animate={props.animate} />
    </group>
  );
}
