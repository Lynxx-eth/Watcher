import { AdditiveBlending, Color, DoubleSide, FrontSide, ShaderMaterial, type IUniform } from "three";

/**
 * Uniforms shared by every holographic surface in the scanner, so one update
 * per frame drives the whole body (reveal, scan line, glow, time).
 */
export interface SharedHoloUniforms {
  uTime: IUniform<number>;
  uReveal: IUniform<number>; // world-space Y; fragments above it are not yet "materialised"
  uScanY: IUniform<number>; // world-space Y of the moving scan band
  uGlow: IUniform<number>; // 0..1 overall intensity
}

export function createSharedUniforms(): SharedHoloUniforms {
  return {
    uTime: { value: 0 },
    uReveal: { value: -0.1 },
    uScanY: { value: 0 },
    uGlow: { value: 0 },
  };
}

const VERT = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHighlightColor;
  uniform float uTime;
  uniform float uReveal;
  uniform float uScanY;
  uniform float uGlow;
  uniform float uHighlight;
  uniform float uBase;      // base opacity of the surface
  uniform float uFresnelK;  // rim strength
  varying vec3 vNormalV;
  varying vec3 vWorld;

  void main() {
    if (vWorld.y > uReveal) discard;

    float fres = pow(1.0 - abs(dot(normalize(vNormalV), vec3(0.0, 0.0, 1.0))), 2.2);
    float lines = step(0.55, fract(vWorld.y * 42.0 - uTime * 0.35)) * 0.18;
    float band = smoothstep(0.05, 0.0, abs(vWorld.y - uScanY));
    float edge = smoothstep(0.07, 0.0, uReveal - vWorld.y);
    float flicker = 0.96 + 0.04 * sin(uTime * 23.0 + vWorld.y * 9.0);

    vec3 col = mix(uColor, uHighlightColor, uHighlight * 0.75);
    float a = (uBase + fres * uFresnelK + lines + band * 0.9 + edge * 1.4 + uHighlight * 0.25) * uGlow * flicker;
    col *= 1.0 + band * 1.6 + edge * 2.2;
    gl_FragColor = vec4(col * a, a);
  }
`;

export interface HoloOptions {
  color?: string;
  base?: number;
  fresnel?: number;
  wireframe?: boolean;
  doubleSide?: boolean;
}

/** Additive, depth-write-off hologram material sharing the scene-wide uniforms. */
export function createHoloMaterial(
  shared: SharedHoloUniforms,
  highlight: IUniform<number>,
  { color = "#00e5ff", base = 0.06, fresnel = 0.9, wireframe = false, doubleSide = false }: HoloOptions = {},
): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...shared,
      uHighlight: highlight,
      uColor: { value: new Color(color) },
      uHighlightColor: { value: new Color("#ffb52e") },
      uBase: { value: base },
      uFresnelK: { value: fresnel },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    wireframe,
    side: doubleSide ? DoubleSide : FrontSide,
  });
}
