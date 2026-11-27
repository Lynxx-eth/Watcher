import { Vector3 } from "three";

/**
 * Lat/lon → point on a sphere, matching three.js SphereGeometry UVs with an
 * equirectangular texture (longitude 0 at the texture centre).
 */
export function latLonToVec3(lat: number, lon: number, radius = 1): Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export interface GlobeLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Every dashboard location is a simulated demo node, never a real person's position. */
  simulated: true;
}

/** Fictional demonstration nodes cycled on the dashboard globe. */
export const DEMO_LOCATIONS: GlobeLocation[] = [
  { id: "SIM-01", label: "Relay Node Aurora", lat: 64.1, lon: -21.9, simulated: true },
  { id: "SIM-02", label: "Relay Node Meridian", lat: 51.5, lon: -0.1, simulated: true },
  { id: "SIM-03", label: "Relay Node Sahel", lat: 12.0, lon: 8.5, simulated: true },
  { id: "SIM-04", label: "Relay Node Monsoon", lat: 19.1, lon: 72.9, simulated: true },
  { id: "SIM-05", label: "Relay Node Kuroshio", lat: 35.7, lon: 139.7, simulated: true },
  { id: "SIM-06", label: "Relay Node Coral", lat: -33.9, lon: 151.2, simulated: true },
  { id: "SIM-07", label: "Relay Node Pampas", lat: -34.6, lon: -58.4, simulated: true },
  { id: "SIM-08", label: "Relay Node Cascade", lat: 47.6, lon: -122.3, simulated: true },
  { id: "SIM-09", label: "Relay Node Atlas", lat: 33.6, lon: -7.6, simulated: true },
  { id: "SIM-10", label: "Relay Node Rift", lat: -1.3, lon: 36.8, simulated: true },
];

export function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}
