import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type IUniform,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createHoloMaterial, type SharedHoloUniforms } from "./holoMaterial";
import { REGIONS, type RegionId } from "./regions";

/**
 * A full human figure (≈1.8 units tall, feet at y = 0) built from smooth
 * primitives, in a relaxed A-pose with the arms slightly away from the body.
 * Each anatomical region is one merged mesh so it can be highlighted and
 * selected; an inner skeleton (skull, spine, ribs, pelvis, limb bones) shows
 * through the translucent skin.
 */

type Part = { g: BufferGeometry; p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] };

function bake(parts: Part[]): BufferGeometry {
  const baked = parts.map(({ g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const m = new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s));
    const c = g.clone();
    // applyMatrix4 also transforms normals (via the normal matrix), so smooth
    // shading survives non-uniform scaling — no recompute needed.
    c.applyMatrix4(m);
    // mergeGeometries needs identical attribute sets; the shader doesn't use UVs.
    c.deleteAttribute("uv");
    return c; // all primitives here are indexed, which mergeGeometries requires consistently
  });
  const merged = mergeGeometries(baked, false);
  if (!merged) throw new Error("body geometry merge failed");
  return merged;
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Segment from a start point along an angle in the XY plane (0° = straight down). */
function limb(start: Vector2, angleDeg: number, length: number) {
  const a = deg(angleDeg);
  const dir = new Vector2(Math.sin(a), -Math.cos(a));
  const end = start.clone().add(dir.clone().multiplyScalar(length));
  const mid = start.clone().add(dir.clone().multiplyScalar(length / 2));
  return { end, mid, rotZ: a };
}

function buildSkin(): Record<RegionId, BufferGeometry> {
  const torsoProfile = [
    [0.0, 0.86], [0.13, 0.87], [0.165, 0.93], [0.17, 0.99], [0.15, 1.06], [0.138, 1.13],
    [0.15, 1.22], [0.172, 1.32], [0.185, 1.4], [0.17, 1.46], [0.1, 1.5], [0.0, 1.51],
  ].map(([x, y]) => new Vector2(x, y));

  const arm = (side: 1 | -1): BufferGeometry => {
    const shoulder = new Vector2(0.205 * side, 1.43);
    const upper = limb(shoulder, 24 * side, 0.3);
    const fore = limb(upper.end, 20 * side, 0.27);
    const hand = limb(fore.end, 17 * side, 0.15);
    return bake([
      { g: new SphereGeometry(0.062, 20, 14), p: [shoulder.x, shoulder.y, 0] },
      { g: new CapsuleGeometry(0.047, 0.26, 6, 16), p: [upper.mid.x, upper.mid.y, 0], r: [0, 0, upper.rotZ] },
      { g: new SphereGeometry(0.043, 16, 12), p: [upper.end.x, upper.end.y, 0] },
      { g: new CapsuleGeometry(0.038, 0.24, 6, 16), p: [fore.mid.x, fore.mid.y, 0], r: [0, 0, fore.rotZ] },
      { g: new CapsuleGeometry(0.03, 0.08, 6, 12), p: [hand.mid.x, hand.mid.y, 0], r: [0, 0, hand.rotZ], s: [1.25, 1, 0.55] },
    ]);
  };

  const leg = (side: 1 | -1): BufferGeometry => {
    const hip = new Vector2(0.092 * side, 0.9);
    const thigh = limb(hip, 2.5 * side, 0.43);
    const shin = limb(thigh.end, -0.5 * side, 0.41);
    return bake([
      { g: new SphereGeometry(0.075, 20, 14), p: [hip.x, hip.y, 0] },
      { g: new CapsuleGeometry(0.068, 0.34, 6, 18), p: [thigh.mid.x, thigh.mid.y, 0], r: [0, 0, thigh.rotZ], s: [1, 1, 1.05] },
      { g: new SphereGeometry(0.052, 16, 12), p: [thigh.end.x, thigh.end.y, 0.005] },
      { g: new CapsuleGeometry(0.048, 0.33, 6, 16), p: [shin.mid.x, shin.mid.y, -0.005], r: [0, 0, shin.rotZ] },
      { g: new CapsuleGeometry(0.036, 0.13, 6, 12), p: [shin.end.x, 0.035, 0.045], r: [deg(90), 0, 0], s: [1.1, 1, 0.75] },
    ]);
  };

  return {
    head: bake([
      { g: new SphereGeometry(1, 32, 24), p: [0, 1.665, 0.005], s: [0.098, 0.122, 0.112] },
      { g: new CylinderGeometry(0.048, 0.056, 0.12, 20, 1, true), p: [0, 1.53, 0] },
    ]),
    torso: bake([{ g: new LatheGeometry(torsoProfile, 40), s: [1, 1, 0.62] }]),
    armR: arm(1),
    armL: arm(-1),
    legR: leg(1),
    legL: leg(-1),
  };
}

function buildSkeleton(): Record<RegionId, BufferGeometry> {
  const bone = (from: Vector2, angle: number, len: number, z = 0): Part => {
    const l = limb(from, angle, len);
    return { g: new CylinderGeometry(0.011, 0.011, len, 6), p: [l.mid.x, l.mid.y, z], r: [0, 0, l.rotZ] };
  };
  const spine: Part[] = Array.from({ length: 20 }, (_, i) => ({
    g: new CylinderGeometry(0.016, 0.016, 0.018, 8),
    p: [0, 0.93 + i * 0.03, -0.045 - Math.sin((i / 19) * Math.PI) * 0.015] as [number, number, number],
  }));
  const ribs: Part[] = Array.from({ length: 7 }, (_, i) => ({
    // Torus lies in XY; rotating 90° about X lays it flat as a horizontal rib loop.
    g: new TorusGeometry(0.13 - Math.abs(i - 3) * 0.006, 0.005, 6, 40),
    p: [0, 1.2 + i * 0.033, -0.01] as [number, number, number],
    r: [deg(90), 0, 0] as [number, number, number],
    s: [1, 0.62, 1] as [number, number, number],
  }));
  const armBones = (side: 1 | -1) => {
    const shoulder = new Vector2(0.205 * side, 1.43);
    const u = limb(shoulder, 24 * side, 0.3);
    return bake([bone(shoulder, 24 * side, 0.3), bone(u.end, 20 * side, 0.27)]);
  };
  const legBones = (side: 1 | -1) => {
    const hip = new Vector2(0.092 * side, 0.9);
    const t = limb(hip, 2.5 * side, 0.43);
    return bake([bone(hip, 2.5 * side, 0.43), bone(t.end, -0.5 * side, 0.41)]);
  };
  return {
    head: bake([{ g: new SphereGeometry(1, 16, 12), p: [0, 1.67, 0], s: [0.075, 0.09, 0.085] }]),
    torso: bake([
      ...spine,
      ...ribs,
      { g: new TorusGeometry(0.1, 0.012, 6, 32), p: [0, 0.93, -0.01], r: [deg(80), 0, 0], s: [1.1, 0.7, 1] },
      { g: new CylinderGeometry(0.008, 0.008, 0.34, 6), p: [0, 1.44, 0.02], r: [0, 0, deg(90)] }, // clavicles
    ]),
    armR: armBones(1),
    armL: armBones(-1),
    legR: legBones(1),
    legL: legBones(-1),
  };
}

export interface BodyProps {
  shared: SharedHoloUniforms;
  highlights: Record<RegionId, IUniform<number>>;
  onHover: (r: RegionId | null) => void;
  onSelect: (r: RegionId) => void;
}

export function ProceduralBody({ shared, highlights, onHover, onSelect }: BodyProps) {
  const skin = useMemo(buildSkin, []);
  const bones = useMemo(buildSkeleton, []);

  const mats = useMemo(() => {
    const out = {} as Record<RegionId, { fill: ReturnType<typeof createHoloMaterial>; wire: ReturnType<typeof createHoloMaterial>; bone: ReturnType<typeof createHoloMaterial> }>;
    for (const id of REGIONS.map((r) => r.id)) {
      out[id] = {
        fill: createHoloMaterial(shared, highlights[id], { base: 0.05, fresnel: 0.95 }),
        wire: createHoloMaterial(shared, highlights[id], { base: 0.1, fresnel: 0.2, wireframe: true }),
        bone: createHoloMaterial(shared, highlights[id], { color: "#9ff3ff", base: 0.35, fresnel: 0.4, doubleSide: true }),
      };
    }
    return out;
  }, [shared, highlights]);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => [m.fill, m.wire, m.bone].forEach((x) => x.dispose()));
      Object.values(skin).forEach((g) => g.dispose());
      Object.values(bones).forEach((g) => g.dispose());
    },
    [mats, skin, bones],
  );

  const handlers = (id: RegionId) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    },
  });

  return (
    <group>
      {REGIONS.map(({ id }) => (
        <group key={id} {...handlers(id)}>
          <mesh geometry={skin[id]} material={mats[id].fill} renderOrder={2} />
          <mesh geometry={skin[id]} material={mats[id].wire} renderOrder={3} raycast={() => null} />
          <mesh geometry={bones[id]} material={mats[id].bone} renderOrder={1} raycast={() => null} />
        </group>
      ))}
    </group>
  );
}
