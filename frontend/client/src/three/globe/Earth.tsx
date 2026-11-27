import { forwardRef, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, SRGBColorSpace, type Mesh } from "three";
import { latLonToVec3 } from "./geo";

export const EARTH_TEXTURES = {
  day: "/textures/earth/earth_day.jpg",
  lights: "/textures/earth/earth_lights.png",
} as const;

/**
 * Textured Earth: NASA-derived day map tinted to the WATCHER blue (oceans go
 * dark navy, land stays lighter) with the night-lights map as emission so
 * populated land glows.
 */
export const Earth = forwardRef<Mesh>(function Earth(_props, ref) {
  const [day, lights] = useTexture([EARTH_TEXTURES.day, EARTH_TEXTURES.lights]);
  day.colorSpace = SRGBColorSpace;
  lights.colorSpace = SRGBColorSpace;
  day.anisotropy = 8;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 128, 96]} />
      <meshStandardMaterial
        map={day}
        color="#4f8fd8"
        emissiveMap={lights}
        emissive="#9fe8ff"
        emissiveIntensity={1.6}
        roughness={0.9}
        metalness={0.05}
      />
    </mesh>
  );
});

/** Used when textures aren't installed: an honest wireframe-style sphere. */
export const FallbackEarth = forwardRef<Mesh>(function FallbackEarth(_props, ref) {
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 64, 48]} />
      <meshStandardMaterial color="#06233d" emissive="#021627" roughness={1} />
    </mesh>
  );
});

const ATMOS_VERT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOS_FRAG = /* glsl */ `
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(uColor, 1.0) * intensity;
  }
`;

/** Fresnel atmosphere shell rendered from the inside, additive. */
export function Atmosphere({ color = "#00bfff" }: { color?: string }) {
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) } }), [color]);
  return (
    <mesh scale={1.16}>
      <sphereGeometry args={[1, 64, 48]} />
      <shaderMaterial
        vertexShader={ATMOS_VERT}
        fragmentShader={ATMOS_FRAG}
        uniforms={uniforms}
        side={BackSide}
        blending={AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/** Latitude/longitude graticule just above the surface. */
export function Graticule({ radius = 1.004 }: { radius?: number }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const push = (a: ReturnType<typeof latLonToVec3>, b: ReturnType<typeof latLonToVec3>) =>
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 4) push(latLonToVec3(lat, lon, radius), latLonToVec3(lat, lon + 4, radius));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -88; lat < 88; lat += 4) push(latLonToVec3(lat, lon, radius), latLonToVec3(lat + 4, lon, radius));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, [radius]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00e5ff" transparent opacity={0.1} depthWrite={false} />
    </lineSegments>
  );
}
