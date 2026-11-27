import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  ShaderMaterial,
  type Group,
} from "three";
import { BRAIN_REGIONS, buildBrain, connect, cortexRegion, sampleNeurons, type BrainRegionId } from "./brainGeometry";

export interface BrainSceneProps {
  reducedMotion: boolean;
  active: BrainRegionId | null;
  onHover: (r: BrainRegionId | null) => void;
  onSelect: (r: BrainRegionId | null) => void;
}

/* ---------------------------------------------------------------- cortex material */

const CORTEX_VERT = /* glsl */ `
  attribute float aRegion;
  varying vec3 vNormalV;
  varying vec3 vLocal;
  varying float vRegion;
  void main() {
    vLocal = position;
    vRegion = aRegion;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const CORTEX_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uActiveColor;
  uniform float uTime; uniform float uIntro; uniform float uActive; uniform float uHover;
  varying vec3 vNormalV; varying vec3 vLocal; varying float vRegion;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormalV), vec3(0.0, 0.0, 1.0))), 2.0);
    float lines = step(0.6, fract(vLocal.y * 30.0 - uTime * 0.4)) * 0.12;
    float sweep = smoothstep(0.08, 0.0, abs(vLocal.z - (fract(uTime * 0.18) * 2.2 - 1.1)));
    float isActive = 1.0 - step(0.5, abs(vRegion - uActive));
    float isHover = 1.0 - step(0.5, abs(vRegion - uHover));
    vec3 col = mix(uColor, uActiveColor, max(isActive, isHover * 0.6));
    float a = (0.05 + fres * 0.85 + lines + sweep * 0.35 + isActive * 0.35 + isHover * 0.15) * uIntro;
    gl_FragColor = vec4(col * a, a);
  }
`;

/* ---------------------------------------------------------------- synapse lines */

const LINE_VERT = /* glsl */ `
  attribute float aT; attribute float aPhase;
  varying float vT; varying float vPhase;
  void main() { vT = aT; vPhase = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const LINE_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform float uIntro;
  varying float vT; varying float vPhase;
  void main() {
    // An impulse travels along each connection; phases are staggered per edge.
    float head = fract(uTime * 0.45 + vPhase);
    float pulse = smoothstep(0.12, 0.0, abs(vT - head));
    float a = (0.08 + pulse * 0.95) * uIntro;
    gl_FragColor = vec4(uColor * a * (1.0 + pulse * 1.5), a);
  }
`;

/* ---------------------------------------------------------------- neuron points */

const NODE_VERT = /* glsl */ `
  uniform float uTime; attribute float aPhase; varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vGlow = 0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 6.2831);
    gl_PointSize = (4.0 + vGlow * 6.0) * (3.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const NODE_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uIntro; varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * (0.4 + vGlow * 0.6) * uIntro;
    gl_FragColor = vec4(uColor * a * 1.6, a);
  }
`;

function additive(vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>) {
  return new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending });
}

function Brain({ reducedMotion, active, onHover, onSelect }: BrainSceneProps) {
  const spin = useRef<Group>(null);
  const hoverRef = useRef<BrainRegionId | null>(null);

  const { cortex, lines, nodes, mats } = useMemo(() => {
    const cortex = buildBrain();
    const neurons = sampleNeurons(cortex, 260);
    const edges = connect(neurons, 3, 0.26);

    const lp = new Float32Array(edges.length * 6);
    const lt = new Float32Array(edges.length * 2);
    const lph = new Float32Array(edges.length * 2);
    edges.forEach(([a, b], i) => {
      lp.set([neurons[a].x, neurons[a].y, neurons[a].z, neurons[b].x, neurons[b].y, neurons[b].z], i * 6);
      lt.set([0, 1], i * 2);
      const ph = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      lph.set([Math.abs(ph), Math.abs(ph)], i * 2);
    });
    const lines = new BufferGeometry();
    lines.setAttribute("position", new BufferAttribute(lp, 3));
    lines.setAttribute("aT", new BufferAttribute(lt, 1));
    lines.setAttribute("aPhase", new BufferAttribute(lph, 1));

    const np = new Float32Array(neurons.length * 3);
    const nph = new Float32Array(neurons.length);
    neurons.forEach((p, i) => {
      np.set([p.x, p.y, p.z], i * 3);
      nph[i] = (i * 0.6180339) % 1;
    });
    const nodes = new BufferGeometry();
    nodes.setAttribute("position", new BufferAttribute(np, 3));
    nodes.setAttribute("aPhase", new BufferAttribute(nph, 1));

    const shared = { uTime: { value: 0 }, uIntro: { value: 0 } };
    const mats = {
      cortex: additive(CORTEX_VERT, CORTEX_FRAG, {
        ...shared,
        uColor: { value: new Color("#00e5ff") },
        uActiveColor: { value: new Color("#ffb52e") },
        uActive: { value: -1 },
        uHover: { value: -1 },
      }),
      wire: additive(CORTEX_VERT, CORTEX_FRAG, {
        ...shared,
        uColor: { value: new Color("#0077b6") },
        uActiveColor: { value: new Color("#ffb52e") },
        uActive: { value: -1 },
        uHover: { value: -1 },
      }),
      lines: additive(LINE_VERT, LINE_FRAG, { ...shared, uColor: { value: new Color("#7df9ff") } }),
      nodes: additive(NODE_VERT, NODE_FRAG, { ...shared, uColor: { value: new Color("#bffcff") } }),
      shared,
    };
    mats.wire.wireframe = true;
    return { cortex, lines, nodes, mats };
  }, []);

  useEffect(
    () => () => {
      [cortex, lines, nodes].forEach((g) => g.dispose());
      [mats.cortex, mats.wire, mats.lines, mats.nodes].forEach((m) => m.dispose());
    },
    [cortex, lines, nodes, mats],
  );

  useFrame((_, dt) => {
    if (!reducedMotion) mats.shared.uTime.value += dt;
    mats.shared.uIntro.value = reducedMotion ? 1 : MathUtils.damp(mats.shared.uIntro.value, 1, 1.6, dt);
    for (const m of [mats.cortex, mats.wire]) {
      m.uniforms.uActive.value = active ?? -1;
      m.uniforms.uHover.value = hoverRef.current ?? -1;
    }
    if (spin.current && !reducedMotion && active === null) spin.current.rotation.y += dt * 0.15;
  });

  // Hit point → lobe (in the brain's local frame, which rotates with `spin`).
  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>): BrainRegionId => {
    const local = spin.current ? spin.current.worldToLocal(e.point.clone()) : e.point;
    if (local.y < -0.42 && local.z > -0.45) return 5;
    if (local.z < -0.38 && local.y < -0.12) return 4;
    return cortexRegion(local);
  };

  return (
    <group ref={spin} rotation={[0.15, -0.6, 0]}>
      <mesh
        geometry={cortex}
        material={mats.cortex}
        onPointerMove={(e) => {
          e.stopPropagation();
          const r = regionAt(e);
          if (r !== hoverRef.current) {
            hoverRef.current = r;
            onHover(r);
          }
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          hoverRef.current = null;
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(regionAt(e));
        }}
      />
      <mesh geometry={cortex} material={mats.wire} scale={1.002} raycast={() => null} />
      <lineSegments geometry={lines} material={mats.lines} />
      <points geometry={nodes} material={mats.nodes} />
    </group>
  );
}

export default function BrainScene(props: BrainSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.25, 3.1], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onSelect(null)}
    >
      <Brain {...props} />
      <OrbitControls enablePan={false} minDistance={1.8} maxDistance={5} enableDamping />
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.25} luminanceSmoothing={0.3} intensity={1.1} />
      </EffectComposer>
    </Canvas>
  );
}

export { BRAIN_REGIONS };
