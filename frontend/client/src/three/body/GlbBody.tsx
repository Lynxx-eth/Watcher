import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Box3, Mesh, Vector3, type Group, type IUniform } from "three";
import { createHoloMaterial, type SharedHoloUniforms } from "./holoMaterial";
import { classifyPoint, type RegionId } from "./regions";

export const BODY_MODEL_URL = "/models/human.glb";

/**
 * Optional: if you place a human anatomy GLB at public/models/human.glb it is
 * used instead of the procedural figure. It's normalised to 1.8 units tall,
 * centred on the platform, and given the same holographic materials. Region
 * selection uses the hit point's height/width (see classifyPoint).
 */
export function GlbBody({
  shared,
  highlight,
  onHover,
  onSelect,
}: {
  shared: SharedHoloUniforms;
  highlight: IUniform<number>;
  onHover: (r: RegionId | null) => void;
  onSelect: (r: RegionId) => void;
}) {
  const { scene } = useGLTF(BODY_MODEL_URL);
  const root = useRef<Group>(null);

  const { model, scale, offset, mats } = useMemo(() => {
    const model = scene.clone(true);
    const fill = createHoloMaterial(shared, highlight, { base: 0.05, fresnel: 0.95, doubleSide: true });
    const wire = createHoloMaterial(shared, highlight, { base: 0.08, fresnel: 0.2, wireframe: true });
    const extra: Mesh[] = [];
    model.traverse((o) => {
      if ((o as Mesh).isMesh) {
        const m = o as Mesh;
        m.material = fill;
        const w = new Mesh(m.geometry, wire);
        w.raycast = () => undefined;
        extra.push(w);
        m.add(w);
      }
    });
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const scale = 1.8 / (size.y || 1);
    const center = box.getCenter(new Vector3());
    const offset = new Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return { model, scale, offset, mats: [fill, wire] };
  }, [scene, shared, highlight]);

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);

  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>): RegionId => {
    const local = root.current ? root.current.worldToLocal(e.point.clone()) : e.point;
    return classifyPoint(local.x, local.y, 1.8);
  };

  return (
    <group
      ref={root}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(regionAt(e));
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(regionAt(e));
      }}
    >
      <primitive object={model} scale={scale} position={offset} />
    </group>
  );
}
