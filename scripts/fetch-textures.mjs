#!/usr/bin/env node
/**
 * Downloads the Earth textures used by the 3D globes into
 * frontend/client/public/textures/earth/.
 *
 * Source: the three.js example textures (MIT-licensed repository), which are
 * derived from NASA Blue Marble / Earth at Night imagery (public domain).
 * Run once: `npm run fetch:textures`
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "client", "public", "textures", "earth");

const FILES = [
  ["earth_atmos_2048.jpg", "earth_day.jpg"],
  ["earth_lights_2048.png", "earth_lights.png"],
];

await mkdir(OUT, { recursive: true });

for (const [src, dest] of FILES) {
  const target = join(OUT, dest);
  try {
    if ((await stat(target)).size > 10_000) {
      console.log(`✓ ${dest} already present`);
      continue;
    }
  } catch {
    /* not downloaded yet */
  }
  process.stdout.write(`↓ ${dest} … `);
  const res = await fetch(BASE + src);
  if (!res.ok) {
    console.error(`failed (${res.status}). Download ${BASE + src} manually and save it as ${target}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buf);
  console.log(`${(buf.length / 1024).toFixed(0)} KB`);
}
