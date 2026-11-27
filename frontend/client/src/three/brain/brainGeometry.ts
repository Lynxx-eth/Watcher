import { BufferAttribute, BufferGeometry, CylinderGeometry, SphereGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural brain: two folded cerebral hemispheres, a ridged cerebellum and a
 * brainstem, in one geometry with a per-vertex `aRegion` attribute so the
 * shader can highlight lobes. Local axes: +Z front, +Y up, +X right.
 */

export const BRAIN_REGIONS = [
  { id: 0, key: "frontal", label: "Frontal Lobe", note: "Planning, decisions, voluntary movement" },
  { id: 1, key: "parietal", label: "Parietal Lobe", note: "Touch, spatial awareness" },
  { id: 2, key: "temporal", label: "Temporal Lobe", note: "Hearing, language, memory" },
  { id: 3, key: "occipital", label: "Occipital Lobe", note: "Vision" },
  { id: 4, key: "cerebellum", label: "Cerebellum", note: "Balance, coordination" },
  { id: 5, key: "brainstem", label: "Brainstem", note: "Breathing, heart rate, sleep" },
] as const;

export type BrainRegionId = (typeof BRAIN_REGIONS)[number]["id"];

/** Lobe from a point on the cerebrum (before folding). */
export function cortexRegion(p: { x: number; y: number; z: number }): BrainRegionId {
  if (p.z > 0.22) return 0;
  if (p.y < -0.08 && p.z > -0.5) return 2;
  if (p.z < -0.5) return 3;
  return 1;
}

/** Ridged pseudo-noise used to fold the cortex into gyri and sulci. */
function folds(x: number, y: number, z: number): number {
  const a = Math.sin(x * 7.3 + Math.sin(y * 5.1) * 1.6 + Math.sin(z * 3.7));
  const b = Math.sin(y * 8.1 + Math.sin(z * 6.3) * 1.4 + Math.sin(x * 4.1) * 0.8);
  const c = Math.sin(z * 7.7 + Math.sin(x * 5.9) * 1.5 + Math.sin(y * 4.7) * 0.9);
  const n = (a + b + c) / 3; // -1..1
  return 1 - Math.abs(n) * 2.2; // ridges where n ≈ 0
}

function hemisphere(side: 1 | -1): BufferGeometry {
  const g = new SphereGeometry(1, 160, 120);
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  const region = new Float32Array(pos.count);
  const v = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Ellipsoid hemisphere; flatter on the medial side and underneath.
    let x = v.x * 0.55;
    let y = v.y * 0.58;
    const z = v.z * 0.86;
    if (x * side < 0) x *= 0.2; // flat medial wall facing the other hemisphere
    if (y < -0.15) y = -0.15 + (y + 0.15) * 0.55; // flatter base
    // Temporal lobe: bulge down/out at the lower front-side.
    const temporal = Math.max(0, -v.y) * Math.max(0, 1 - Math.abs(v.z - 0.1) * 1.4) * Math.max(0, v.x * side);
    x += side * temporal * 0.06;
    y -= temporal * 0.1;
    const base = { x: x + side * 0.125, y: y + 0.08, z };
    region[i] = cortexRegion({ x: base.x, y: base.y, z: base.z });

    n.set(x, y, z).normalize();
    const f = folds(base.x * 3, base.y * 3, base.z * 3);
    const depth = f * 0.03 * (x * side < 0 ? 0.3 : 1); // shallower folds on the medial wall
    pos.setXYZ(i, base.x + n.x * depth, base.y + n.y * depth, base.z + n.z * depth);
  }
  g.setAttribute("aRegion", new BufferAttribute(region, 1));
  g.computeVertexNormals();
  return g;
}

function cerebellum(): BufferGeometry {
  const g = new SphereGeometry(1, 96, 64);
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ridge = 1 + Math.sin(v.y * 40) * 0.025; // horizontal folia
    pos.setXYZ(i, v.x * 0.5 * ridge, v.y * 0.24 * ridge - 0.3, v.z * 0.28 * ridge - 0.55);
  }
  g.setAttribute("aRegion", new BufferAttribute(new Float32Array(pos.count).fill(4), 1));
  g.computeVertexNormals();
  return g;
}

function brainstem(): BufferGeometry {
  const g = new CylinderGeometry(0.11, 0.075, 0.62, 32, 8, false);
  g.deleteAttribute("uv");
  g.rotateX(-0.35);
  g.translate(0, -0.58, -0.3);
  const count = g.getAttribute("position").count;
  g.setAttribute("aRegion", new BufferAttribute(new Float32Array(count).fill(5), 1));
  return g;
}

export function buildBrain(): BufferGeometry {
  const merged = mergeGeometries([hemisphere(1), hemisphere(-1), cerebellum(), brainstem()], false);
  if (!merged) throw new Error("brain geometry merge failed");
  merged.computeBoundingSphere();
  return merged;
}

/** Points just under the cortex surface (from the geometry), for the neural network. */
export function sampleNeurons(geo: BufferGeometry, count: number, seed = 7): Vector3[] {
  const pos = geo.getAttribute("position");
  const reg = geo.getAttribute("aRegion");
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: Vector3[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const i = Math.floor(rand() * pos.count);
    if (reg.getX(i) === 5) continue; // skip brainstem
    const p = new Vector3().fromBufferAttribute(pos, i).multiplyScalar(0.9 + rand() * 0.06);
    out.push(p);
  }
  return out;
}

/** Connect each neuron to its nearest neighbours (deduplicated). */
export function connect(points: Vector3[], k = 3, maxDist = 0.28): Array<[number, number]> {
  const edges = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    const near = points
      .map((p, j) => ({ j, d: p.distanceTo(points[i]) }))
      .filter((e) => e.j !== i && e.d < maxDist)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!edges.has(key)) {
        edges.add(key);
        out.push([Math.min(i, j), Math.max(i, j)]);
      }
    }
  }
  return out;
}
