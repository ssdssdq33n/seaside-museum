// ---------------------------------------------------------------------------
//  Logic verification for the museum layout.
//  Checks placement, spacing, bounds, waypoints and collision — no rendering.
//  Run:  node scripts/verify.mjs   (or: npm run verify)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLayout, CONFIG } from "../src/gallery/layout.js";
import { resolve } from "../src/gallery/collision.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src", "data", "photos.json"), "utf8")
);
const photos = manifest.photos;

let pass = 0;
let fail = 0;
const problems = [];
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    problems.push(`✗ ${name}${detail ? "  — " + detail : ""}`);
  }
}

const L = buildLayout(photos, CONFIG);
const c = CONFIG;
const r = c.playerRadius;
const EPS = 1e-6;

// 1. Every photo is placed, uniquely.
check("all photos placed", L.placedCount === photos.length, `placed ${L.placedCount}/${photos.length}, capacity ${L.slotCount}`);
check("enough capacity", L.slotCount >= photos.length, `slots ${L.slotCount}`);
check("no duplicate photo ids", new Set(photos.map((p) => p.id)).size === photos.length);
check("frames reference distinct photos", new Set(L.frames.map((f) => f.photo.id)).size === L.frames.length);

const outerW = (f) => f.imgW + 2 * (f.mat + f.frame);
const outerH = (f) => f.imgH + 2 * (f.mat + f.frame);

// 2. Frames inside the hall, clear of the floor and the wall top.
const MIN_CLEARANCE = 0.55; // bottom of frame must be this far off the floor
for (const f of L.frames) {
  const inside = f.x > L.bounds.minX - 0.5 && f.x < L.bounds.maxX + 0.5 && f.z > L.bounds.minZ - 0.5 && f.z < L.bounds.maxZ + 0.5;
  check(`frame ${f.index} inside hall`, inside, `(${f.x.toFixed(1)}, ${f.z.toFixed(1)})`);
  const half = outerH(f) / 2;
  const bottom = f.y - half;
  const top = f.y + half;
  check(`frame ${f.index} off the floor`, bottom >= MIN_CLEARANCE, `bottom ${bottom.toFixed(2)}`);
  check(`frame ${f.index} below wall top`, top < f.wallH - 0.25, `top ${top.toFixed(2)} / wall ${f.wallH}`);
}

// 3. No overlap between neighbouring frames on the same wall face.
const groups = new Map();
for (const f of L.frames) {
  const horizontal = Math.abs(Math.sin(f.rotY)) < 0.5; // faces ±z -> varies along x
  const key = horizontal ? `z@${f.z.toFixed(2)}` : `x@${f.x.toFixed(2)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ f, horizontal });
}
for (const [key, arr] of groups) {
  arr.sort((a, b) => (a.horizontal ? a.f.x - b.f.x : a.f.z - b.f.z));
  for (let i = 1; i < arr.length; i++) {
    const a = arr[i - 1].f;
    const b = arr[i].f;
    const gap = arr[i].horizontal ? b.x - a.x : b.z - a.z;
    const need = outerW(a) / 2 + outerW(b) / 2 + 0.2;
    check(`no overlap on ${key} (#${a.index}/#${b.index})`, gap >= need, `gap ${gap.toFixed(2)} < ${need.toFixed(2)}`);
  }
}

// 3b. No pilaster cuts across an artwork.
const pilHalf = c.pilaster.width / 2;
for (const f of L.frames) {
  const horizontal = Math.abs(Math.sin(f.rotY)) < 0.5; // faces ±z -> on an N/S wall
  const halfW = outerW(f) / 2;
  for (const p of L.pilasters) {
    if (horizontal) {
      if (Math.abs(f.z - p.z) < 0.8) {
        const d = Math.abs(f.x - p.x);
        check(`frame ${f.index} clears pilaster @x${p.x.toFixed(1)}`, d >= halfW + pilHalf + 0.05, `gap ${d.toFixed(2)} < ${(halfW + pilHalf).toFixed(2)}`);
      }
    } else {
      if (Math.abs(f.x - p.x) < 0.8) {
        const d = Math.abs(f.z - p.z);
        check(`frame ${f.index} clears pilaster @z${p.z.toFixed(1)}`, d >= halfW + pilHalf + 0.05, `gap ${d.toFixed(2)} < ${(halfW + pilHalf).toFixed(2)}`);
      }
    }
  }
}

// 4. Spawn is valid.
{
  const res = resolve(L.spawn.x, L.spawn.z, L.bounds, L.colliders, r);
  check("spawn collision-free", Math.abs(res.x - L.spawn.x) < EPS && Math.abs(res.z - L.spawn.z) < EPS, `-> (${res.x.toFixed(2)}, ${res.z.toFixed(2)})`);
}

// 5. Every viewpoint is reachable, in front of its art, facing it.
for (const f of L.frames) {
  const v = f.viewpoint;
  const res = resolve(v.x, v.z, L.bounds, L.colliders, r);
  check(`viewpoint ${f.index} collision-free`, Math.abs(res.x - v.x) < 1e-3 && Math.abs(res.z - v.z) < 1e-3, `(${v.x.toFixed(2)}, ${v.z.toFixed(2)}) -> (${res.x.toFixed(2)}, ${res.z.toFixed(2)})`);
  const [nx, nz] = f.normal;
  const dot = (v.x - f.x) * nx + (v.z - f.z) * nz;
  check(`viewpoint ${f.index} in front of art`, dot > 0.5, `dot ${dot.toFixed(2)}`);
  const facing = -Math.sin(v.yaw) * -nx + -Math.cos(v.yaw) * -nz;
  check(`viewpoint ${f.index} yaw faces art`, facing > 0.99, `facing ${facing.toFixed(3)}`);
}

// 6. Collision rejects wall interiors and the outer boundary; frees open floor.
{
  for (const w of L.walls) {
    const res = resolve(w.cx, w.cz, L.bounds, L.colliders, r);
    const movedOut = Math.hypot(res.x - w.cx, res.z - w.cz) > 0.05;
    check(`wall '${w.id}' is solid`, movedOut, `-> (${res.x.toFixed(2)}, ${res.z.toFixed(2)})`);
  }
  const open = resolve(-3, 12, L.bounds, L.colliders, r);
  check("open floor is free", Math.abs(open.x + 3) < EPS && Math.abs(open.z - 12) < EPS);
  const outX = resolve(999, 0, L.bounds, L.colliders, r);
  check("cannot leave east wall", outX.x <= L.bounds.maxX - r + EPS, `x ${outX.x.toFixed(2)}`);
  const outZ = resolve(0, -999, L.bounds, L.colliders, r);
  check("cannot leave north wall", outZ.z >= L.bounds.minZ + r - EPS, `z ${outZ.z.toFixed(2)}`);
}

// ---- report ----
console.log("\nMuseum layout verification");
console.log("──────────────────────────");
console.log(`photos:        ${photos.length}`);
console.log(`placed:        ${L.placedCount}`);
console.log(`slot capacity: ${L.slotCount}`);
const land = L.frames.filter((f) => f.photo.orientation === "landscape").length;
const large = L.frames.filter((f) => f.size === "L").length;
console.log(`orientation:   ${land} landscape / ${L.frames.length - land} portrait`);
console.log(`sizes:         ${large} large / ${L.frames.length - large} medium`);
console.log("──────────────────────────");
if (problems.length) {
  console.log(problems.join("\n"));
  console.log("──────────────────────────");
}
console.log(`${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
