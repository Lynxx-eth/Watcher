export type RegionId = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

export interface RegionInfo {
  id: RegionId;
  label: string;
  /** Anchor for the coordinate indicator, in scene units (feet at y = 0). */
  anchor: [number, number, number];
}

export const REGIONS: RegionInfo[] = [
  { id: "head", label: "Cranial", anchor: [0.16, 1.68, 0] },
  { id: "torso", label: "Thoracic / Abdominal", anchor: [0.24, 1.18, 0] },
  { id: "armR", label: "Right Upper Limb", anchor: [0.52, 0.98, 0] },
  { id: "armL", label: "Left Upper Limb", anchor: [-0.52, 0.98, 0] },
  { id: "legR", label: "Right Lower Limb", anchor: [0.2, 0.42, 0] },
  { id: "legL", label: "Left Lower Limb", anchor: [-0.2, 0.42, 0] },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionInfo>;

/**
 * Classify a hit point on a single-mesh model (GLB) into a region using
 * normalised height/width, for models that aren't split into parts.
 */
export function classifyPoint(x: number, y: number, height: number): RegionId {
  const h = y / height;
  if (h > 0.86) return "head";
  if (h < 0.5) return x >= 0 ? "legR" : "legL";
  if (Math.abs(x) > 0.2 * (height / 1.8)) return x >= 0 ? "armR" : "armL";
  return "torso";
}
