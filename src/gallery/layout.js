// ---------------------------------------------------------------------------
//  Museum layout — pure geometry, no three.js import.
//  Grand open plan. Outer walls are divided into BAYS by pilasters and each
//  bay holds one centred artwork (classic gallery hang); interior feature
//  walls carry the larger pieces. Vertical placement keeps every frame clear
//  of the floor and ceiling.
// ---------------------------------------------------------------------------

export const CONFIG = {
  wallX: 30, // interior x ∈ [-30, 30]  -> width 60
  wallZ: 21, // interior z ∈ [-21, 21]  -> depth 42
  wallHeight: 6.4,
  wallThickness: 0.35,

  playerRadius: 0.42,
  eyeHeight: 1.62,

  idealCenterY: 1.56, // museum "eye line"
  minBottom: 0.72, // keep the frame this far off the floor
  topMargin: 0.6, // keep the frame this far below the wall top
  wallOffset: 0.07,
  endMargin: 1.2,

  pilaster: { width: 0.9, relief: 0.26 },
  bayGap: 0.45, // clearance between a pilaster and the artwork beside it

  sizes: {
    L: { landW: 2.7, portH: 1.95, pitch: 6.4, mat: 0.22, frame: 0.085, fillet: 0.03, viewDist: 4.0 },
    M: { landW: 1.95, portH: 1.5, pitch: 4.6, mat: 0.17, frame: 0.06, fillet: 0.025, viewDist: 3.1 },
  },
};

export const ZONES = [
  { name: "Khởi đầu", subtitle: "Prelude", xMin: -30, xMax: 30, zMin: 8, zMax: 21 },
  { name: "Cánh Tây", subtitle: "West Wing", xMin: -30, xMax: -10, zMin: -8, zMax: 8 },
  { name: "Khoảnh khắc", subtitle: "Moments", xMin: -10, xMax: 10, zMin: -8, zMax: 8 },
  { name: "Cánh Đông", subtitle: "East Wing", xMin: 10, xMax: 30, zMin: -8, zMax: 8 },
  { name: "Biển cả", subtitle: "The Open Sea", xMin: -30, xMax: 30, zMin: -21, zMax: -8 },
];

// Outer walls: photo span [lo,hi] along the wall, divided into `bays` by pilasters.
function outerWalls(c) {
  const Z = c.wallZ, X = c.wallX, off = c.wallOffset;
  return [
    { axis: "x", inner: Z, face: Z - off, rotY: Math.PI, normal: [0, -1], lo: 8.5, hi: 29, bays: 3, zone: "prelude", pilYaw: 0, pilSide: -1 },
    { axis: "z", inner: X, face: X - off, rotY: -Math.PI / 2, normal: [-1, 0], lo: -16, hi: 16, bays: 4, zone: "east", pilYaw: Math.PI / 2, pilSide: -1 },
    { axis: "x", inner: -Z, face: -Z + off, rotY: 0, normal: [0, 1], lo: -29, hi: 29, bays: 8, zone: "sea", pilYaw: 0, pilSide: 1 },
    { axis: "z", inner: -X, face: -X + off, rotY: Math.PI / 2, normal: [1, 0], lo: -16, hi: 16, bays: 4, zone: "west", pilYaw: Math.PI / 2, pilSide: 1 },
    { axis: "x", inner: Z, face: Z - off, rotY: Math.PI, normal: [0, -1], lo: -29, hi: -8.5, bays: 3, zone: "prelude", pilYaw: 0, pilSide: -1 },
  ];
}

function interiorWalls() {
  return [
    { id: "feature", axis: "x", at: 0, from: -8, to: 8, thickness: 0.55, height: 5.4, size: "L", zone: "moments", accent: true },
    { id: "northwall", axis: "x", at: -12, from: -9, to: 9, thickness: 0.45, height: 5.0, size: "M", zone: "sea", accent: true },
    { id: "westfin", axis: "z", at: -19, from: -7, to: 7, thickness: 0.42, height: 5.0, size: "M", zone: "west" },
    { id: "eastfin", axis: "z", at: 19, from: -7, to: 7, thickness: 0.42, height: 5.0, size: "M", zone: "east" },
  ];
}

function evenSpread(a, b, n) {
  const len = b - a;
  const out = [];
  for (let k = 0; k < n; k++) out.push(a + (len * (k + 0.5)) / n);
  return out;
}

function apportion(caps, total) {
  const sum = caps.reduce((s, c) => s + c, 0);
  if (sum <= total) return caps.slice();
  const exact = caps.map((c) => (c * total) / sum);
  const base = exact.map((x) => Math.floor(x));
  let used = base.reduce((s, x) => s + x, 0);
  const rem = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  let k = 0;
  while (used < total && k < rem.length) base[rem[k++].i]++, used++;
  return base;
}

// Build the list of hangable faces (one per bay for outer walls) + pilasters.
function buildFacesAndPilasters(c) {
  const faces = [];
  const pilasters = [];
  const pilHalf = c.pilaster.width / 2;
  const relief = c.pilaster.relief;

  for (const w of outerWalls(c)) {
    const dividers = [];
    for (let i = 0; i <= w.bays; i++) dividers.push(w.lo + ((w.hi - w.lo) * i) / w.bays);

    // pilaster at each divider, sitting against the wall and proud into the room
    for (const d of dividers) {
      const pil = { yaw: w.pilYaw };
      const pushIn = (w.inner > 0 ? -1 : 1) * (relief / 2);
      if (w.axis === "x") {
        pil.x = d;
        pil.z = w.inner + pushIn;
      } else {
        pil.z = d;
        pil.x = w.inner + pushIn;
      }
      pilasters.push(pil);
    }

    // one face per bay (between consecutive dividers, inset past the pilasters)
    for (let i = 0; i < w.bays; i++) {
      const a = dividers[i] + pilHalf + c.bayGap;
      const b = dividers[i + 1] - pilHalf - c.bayGap;
      if (b - a < 0.6) continue;
      faces.push({ axis: w.axis, fixed: w.face, range: [a, b], rotY: w.rotY, normal: w.normal, size: "M", zone: w.zone, wallH: c.wallHeight });
    }
  }

  // interior walls (no pilasters, hung directly)
  const off = c.wallOffset;
  const m = c.endMargin;
  const inset = (a, b) => [a + m, b - m];
  for (const w of interiorWalls()) {
    if (w.axis === "x") {
      faces.push({ axis: "x", fixed: w.at + w.thickness / 2 + off, range: inset(w.from, w.to), rotY: 0, normal: [0, 1], size: w.size, zone: w.zone, wallH: w.height });
      faces.push({ axis: "x", fixed: w.at - w.thickness / 2 - off, range: inset(w.from, w.to), rotY: Math.PI, normal: [0, -1], size: w.size, zone: w.zone, wallH: w.height });
    } else {
      faces.push({ axis: "z", fixed: w.at + w.thickness / 2 + off, range: inset(w.from, w.to), rotY: Math.PI / 2, normal: [1, 0], size: w.size, zone: w.zone, wallH: w.height });
      faces.push({ axis: "z", fixed: w.at - w.thickness / 2 - off, range: inset(w.from, w.to), rotY: -Math.PI / 2, normal: [-1, 0], size: w.size, zone: w.zone, wallH: w.height });
    }
  }
  return { faces, pilasters };
}

// Vertical centre: eye-line, but never below minBottom or above the wall top.
function frameCenterY(c, half, wallH) {
  let center = Math.max(c.idealCenterY, c.minBottom + half);
  const maxTop = wallH - c.topMargin;
  if (center + half > maxTop) center = maxTop - half;
  return center;
}

export function buildLayout(photos, cfg = CONFIG) {
  const c = cfg;
  const { faces, pilasters } = buildFacesAndPilasters(c);

  const caps = faces.map((f) => Math.max(0, Math.floor((f.range[1] - f.range[0]) / c.sizes[f.size].pitch)));
  const totalCap = caps.reduce((s, x) => s + x, 0);
  const used = apportion(caps, Math.min(photos.length, totalCap));

  const frames = [];
  let pi = 0;
  for (let fi = 0; fi < faces.length && pi < photos.length; fi++) {
    const f = faces[fi];
    const n = used[fi];
    if (n <= 0) continue;
    const s = c.sizes[f.size];
    for (const t of evenSpread(f.range[0], f.range[1], n)) {
      if (pi >= photos.length) break;
      const photo = photos[pi++];
      const ratio = photo.ratio || photo.width / photo.height || 1.5;

      let imgW, imgH;
      if (photo.orientation === "portrait" || ratio < 1) {
        imgH = s.portH;
        imgW = imgH * ratio;
      } else {
        imgW = s.landW;
        imgH = imgW / ratio;
      }
      const half = imgH / 2 + s.mat + s.frame + s.fillet;
      const y = frameCenterY(c, half, f.wallH);

      const x = f.axis === "x" ? t : f.fixed;
      const z = f.axis === "z" ? t : f.fixed;
      const [nx, nz] = f.normal;
      const viewpoint = { x: x + nx * s.viewDist, z: z + nz * s.viewDist, yaw: Math.atan2(nx, nz) };

      frames.push({
        index: frames.length,
        photo, x, y, z, rotY: f.rotY, normal: f.normal,
        imgW, imgH, size: f.size, mat: s.mat, frame: s.frame, fillet: s.fillet,
        wallH: f.wallH, viewpoint, zone: f.zone,
      });
    }
  }

  // interior walls -> render + collision
  const walls = interiorWalls().map((w) => ({
    id: w.id,
    cx: w.axis === "x" ? (w.from + w.to) / 2 : w.at,
    cz: w.axis === "z" ? (w.from + w.to) / 2 : w.at,
    w: w.axis === "x" ? w.to - w.from : w.thickness,
    d: w.axis === "z" ? w.to - w.from : w.thickness,
    h: w.height,
    accent: !!w.accent,
  }));
  const colliders = walls.map((w) => ({ minX: w.cx - w.w / 2, maxX: w.cx + w.w / 2, minZ: w.cz - w.d / 2, maxZ: w.cz + w.d / 2 }));

  const benches = [
    { x: 0, z: 8.5, length: 3.0, width: 0.58, height: 0.45, axis: "x" },
    { x: -25.5, z: 0, length: 2.6, width: 0.55, height: 0.45, axis: "z" },
    { x: 25.5, z: 0, length: 2.6, width: 0.55, height: 0.45, axis: "z" },
    { x: 0, z: -17, length: 3.0, width: 0.58, height: 0.45, axis: "x" },
  ];
  for (const b of benches) {
    const halfX = (b.axis === "z" ? b.width : b.length) / 2;
    const halfZ = (b.axis === "z" ? b.length : b.width) / 2;
    colliders.push({ minX: b.x - halfX, maxX: b.x + halfX, minZ: b.z - halfZ, maxZ: b.z + halfZ });
  }

  const bounds = { minX: -c.wallX, maxX: c.wallX, minZ: -c.wallZ, maxZ: c.wallZ };
  const spawn = { x: 0, z: c.wallZ - 3.5, yaw: 0 };

  return {
    config: c, zones: ZONES, frames, walls, pilasters, colliders, bounds, spawn, benches,
    placedCount: frames.length, slotCount: totalCap,
  };
}
