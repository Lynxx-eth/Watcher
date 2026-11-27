import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, QuadraticBezierLine } from "@react-three/drei";
import { DoubleSide, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Object3D } from "three";
import { fmtCoord, latLonToVec3, type GlobeLocation } from "./geo";

const OUT = new Vector3(0, 0, 1);

export interface MarkerProps {
  loc: GlobeLocation | { id: string; label: string; lat: number; lon: number; simulated?: boolean };
  color?: string;
  active?: boolean;
  selected?: boolean;
  showLabel?: boolean;
  animate: boolean;
  occluder: RefObject<Mesh | null>;
  onSelect?: (id: string) => void;
}

/** Glowing point + expanding scan pulse + optional label, oriented to the surface normal. */
export function Marker({ loc, color = "#00e5ff", active, selected, showLabel, animate, occluder, onSelect }: MarkerProps) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);
  const pos = useMemo(() => latLonToVec3(loc.lat, loc.lon, 1.006), [loc.lat, loc.lon]);

  useLayoutEffect(() => {
    group.current?.quaternion.setFromUnitVectors(OUT, pos.clone().normalize());
  }, [pos]);

  useFrame(({ clock }) => {
    if (!animate) return;
    const pulse = (offset: number, m: Mesh | null) => {
      if (!m) return;
      const t = ((clock.elapsedTime + offset) % 1.8) / 1.8;
      const s = 1 + t * (active ? 5 : 2.5);
      m.scale.set(s, s, s);
      (m.material as MeshBasicMaterial).opacity = (1 - t) * (active ? 0.9 : 0.45);
    };
    pulse(0, ring.current);
    pulse(0.9, ring2.current);
  });

  const dot = active || selected ? 0.022 : 0.013;

  return (
    <group ref={group} position={pos}>
      <mesh>
        <circleGeometry args={[dot, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} side={DoubleSide} />
      </mesh>
      {/* Larger invisible hit area so small markers are easy to click. */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(loc.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <circleGeometry args={[0.05, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.02, 0.026, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} side={DoubleSide} depthWrite={false} />
      </mesh>
      {active && (
        <mesh ref={ring2}>
          <ringGeometry args={[0.02, 0.024, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} side={DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {(showLabel || selected) && (
        <Html position={[0, 0, 0.02]} occlude={[occluder as RefObject<Object3D>]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={`globe-label${selected ? " is-selected" : ""}`} style={{ borderColor: color }}>
            <span className="globe-label__id">{loc.id}</span>
            <span>{loc.label}</span>
            <span className="globe-label__coord">{fmtCoord(loc.lat, loc.lon)}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Dashed great-arc between two locations, lifted above the surface; dash flows toward the target. */
export function Arc({ from, to, animate, color = "#00bfff" }: { from: GlobeLocation; to: GlobeLocation; animate: boolean; color?: string }) {
  const { start, end, mid } = useMemo(() => {
    const a = latLonToVec3(from.lat, from.lon, 1.005);
    const b = latLonToVec3(to.lat, to.lon, 1.005);
    const lift = 1 + a.distanceTo(b) * 0.35;
    const m = a.clone().add(b).normalize().multiplyScalar(lift);
    return { start: a, end: b, mid: m };
  }, [from, to]);

  // QuadraticBezierLine renders a Line2; its material exposes dashOffset.
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, dt) => {
    if (animate && line.current) line.current.material.dashOffset -= dt * 0.6;
  });

  return (
    <QuadraticBezierLine
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={line as any}
      start={start}
      end={end}
      mid={mid}
      color={color}
      lineWidth={1.4}
      dashed
      dashSize={0.04}
      gapSize={0.025}
      transparent
      opacity={0.85}
      toneMapped={false}
    />
  );
}
