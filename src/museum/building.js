// ---------------------------------------------------------------------------
//  Museum shell with a classical-gallery treatment:
//  diamond marble floor, coffered ceiling + central skylight, pilasters with
//  gilt capitals, stepped cornice, dado rail, accent feature walls, signage.
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { plasterTexture, floorTexture, signTexture } from "./textures.js";

export function createMuseum(scene, layout, renderer, opts = {}) {
  const c = layout.config;
  const useShadows = opts.shadows !== false;
  const useReflection = opts.reflections !== false;
  const W = c.wallX;
  const D = c.wallZ;
  const H = c.wallHeight;
  const t = c.wallThickness;

  // Image-based lighting for soft reflections on every PBR surface.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  // --- materials ---
  const wallTex = plasterTexture();
  wallTex.repeat.set(6, 1.6);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.93, metalness: 0, envMapIntensity: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x566e70, roughness: 0.88, metalness: 0, envMapIntensity: 0.45 });

  const flrTex = floorTexture();
  flrTex.repeat.set(11, 8);
  flrTex.center.set(0.5, 0.5);
  flrTex.rotation = Math.PI / 4; // diamond lay
  const floorMat = new THREE.MeshStandardMaterial({ map: flrTex, color: 0xf2eee6, roughness: 0.22, metalness: 0, envMapIntensity: 0.85 });
  const darkMarble = new THREE.MeshStandardMaterial({ color: 0x4f4a42, roughness: 0.25, metalness: 0, envMapIntensity: 0.8 });

  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 1, metalness: 0 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf2ece1, roughness: 0.7, metalness: 0, envMapIntensity: 0.5 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xd7cdbd, roughness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc2a469, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.1 });
  const marbleCol = new THREE.MeshStandardMaterial({ color: 0xece7dd, roughness: 0.35, metalness: 0, envMapIntensity: 0.7 });
  const skyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e2, emissiveIntensity: 1.25, roughness: 1 });

  // --- floor (optionally over a planar reflector) + marble border + medallion ---
  if (useReflection) {
    const refl = new Reflector(new THREE.PlaneGeometry(2 * W, 2 * D), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x6f7678,
      clipBias: 0.004,
    });
    refl.rotation.x = -Math.PI / 2;
    refl.position.y = 0.0;
    scene.add(refl);
    floorMat.transparent = true;
    floorMat.opacity = 0.74; // marble over the reflection = polished stone
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = useReflection ? 0.02 : 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const bw = 1.0; // border band width, inset from the walls
  const bInset = 2.2;
  const borderGeoNS = new THREE.PlaneGeometry(2 * (W - bInset) + bw, bw);
  const borderGeoEW = new THREE.PlaneGeometry(bw, 2 * (D - bInset) - bw);
  for (const [geo, x, z] of [
    [borderGeoNS, 0, -(D - bInset)], [borderGeoNS, 0, D - bInset],
    [borderGeoEW, -(W - bInset), 0], [borderGeoEW, W - bInset, 0],
  ]) {
    const m = new THREE.Mesh(geo, darkMarble);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    scene.add(m);
  }
  // medallion under the feature area
  const medallion = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.7, 48), darkMarble);
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.set(0, 0.035, 2.5);
  scene.add(medallion);
  const medallion2 = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.0, 48), goldMat);
  medallion2.rotation.x = -Math.PI / 2;
  medallion2.position.set(0, 0.04, 2.5);
  scene.add(medallion2);

  // --- ceiling + coffers + skylight ---
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * D), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  // coffer beams (outer ring, leaving the centre for the skylight)
  const beamMat = trimMat;
  const beamDrop = 0.3;
  const beamY = H - beamDrop / 2;
  const addBeamX = (z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 * W, beamDrop, 0.55), beamMat);
    b.position.set(0, beamY, z);
    scene.add(b);
  };
  const addBeamZ = (x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, beamDrop, 2 * D), beamMat);
    b.position.set(x, beamY, 0);
    scene.add(b);
  };
  for (const z of [-D + 6, D - 6, -12, 12]) addBeamX(z);
  for (const x of [-W + 7, W - 7, -16, 16]) addBeamZ(x);

  // --- domed ceiling rose + oculus skylight, centred over the medallion ---
  const domeX = 0, domeZ = 2.5;
  // concave shallow dome (seen from below)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.32),
    new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 1, side: THREE.BackSide, envMapIntensity: 0.3 })
  );
  dome.position.set(domeX, H - 2.7, domeZ);
  scene.add(dome);
  // stepped gilt rings framing the dome
  for (const [rad, yy] of [[9.4, H - 0.08], [6.8, H - 0.5], [4.6, H - 0.95]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.1, 10, 64), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(domeX, yy, domeZ);
    scene.add(ring);
  }
  // radial ribs
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 5.0), goldMat);
    rib.position.set(domeX + Math.cos(a) * 7, H - 0.5, domeZ + Math.sin(a) * 7);
    rib.rotation.y = -a;
    scene.add(rib);
  }
  // oculus skylight (bright, warm daylight)
  const oculus = new THREE.Mesh(new THREE.CircleGeometry(2.7, 48), skyMat);
  oculus.rotation.x = Math.PI / 2;
  oculus.position.set(domeX, H - 2.65, domeZ);
  scene.add(oculus);

  // --- crystal chandelier hanging from the oculus ---
  const chand = new THREE.Group();
  chand.position.set(domeX, 0, domeZ);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.1 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), goldMat);
  rod.position.y = H - 1.4;
  chand.add(rod);
  const tiers = [[1.5, H - 2.1, 16], [1.05, H - 2.55, 12], [0.6, H - 2.9, 8]];
  for (const [rad, yy, n] of tiers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.035, 8, 40), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yy;
    chand.add(ring);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const drop = 0.18 + (i % 3) * 0.1;
      const crys = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), crystalMat);
      crys.position.set(Math.cos(a) * rad, yy - drop, Math.sin(a) * rad);
      chand.add(crys);
    }
  }
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), crystalMat);
  finial.position.y = H - 3.05;
  chand.add(finial);
  scene.add(chand);
  const chandLight = new THREE.PointLight(0xffe6b8, 30, 30, 2.0);
  chandLight.position.set(domeX, H - 2.6, domeZ);
  scene.add(chandLight);

  // --- wall helpers (cornice + baseboard + dado rail) ---
  function addTrims(cx, cz, w, d, h) {
    // stepped cornice
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.22, d + 0.1), trimMat);
    c1.position.set(cx, h - 0.14, cz);
    scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.1, d + 0.22), trimMat);
    c2.position.set(cx, h - 0.3, cz);
    scene.add(c2);
    const gold = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.03, d + 0.12), goldMat);
    gold.position.set(cx, h - 0.27, cz);
    scene.add(gold);
    // baseboard
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.28, d + 0.08), baseMat);
    base.position.set(cx, 0.14, cz);
    scene.add(base);
    // dado rail
    const dado = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.05, d + 0.05), trimMat);
    dado.position.set(cx, 1.05, cz);
    scene.add(dado);
  }

  function addWall(cx, cz, w, d, h, mat, { trims = true, cap = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (trims) addTrims(cx, cz, w, d, h);
    if (cap) {
      const capM = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.1, d + 0.14), trimMat);
      capM.position.set(cx, h, cz);
      scene.add(capM);
      const g = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.03, d + 0.16), goldMat);
      g.position.set(cx, h - 0.06, cz);
      scene.add(g);
    }
    return m;
  }

  // --- outer walls ---
  addWall(0, -D - t / 2, 2 * W + 2 * t, t, H, wallMat);
  addWall(0, D + t / 2, 2 * W + 2 * t, t, H, wallMat);
  addWall(-W - t / 2, 0, t, 2 * D + 2 * t, H, wallMat);
  addWall(W + t / 2, 0, t, 2 * D + 2 * t, H, wallMat);

  // --- interior walls ---
  for (const w of layout.walls) {
    addWall(w.cx, w.cz, w.w, w.d, w.h, w.accent ? accentMat : wallMat, { trims: false, cap: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.06, 0.24, w.d + 0.06), baseMat);
    base.position.set(w.cx, 0.12, w.cz);
    scene.add(base);
  }

  // --- pilasters with gilt capitals (positions computed in layout, in the bays) ---
  const pilW = c.pilaster.width;
  const pilRelief = c.pilaster.relief;
  function pilaster(x, z, yaw) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    const sw = pilW, relief = pilRelief, sh = H - 1.35;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, relief), marbleCol);
    shaft.position.y = 0.55 + sh / 2;
    shaft.castShadow = true;
    g.add(shaft);
    const base = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.2, 0.42, relief + 0.14), marbleCol);
    base.position.y = 0.3;
    g.add(base);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.08, 0.1, relief + 0.06), goldMat);
    neck.position.y = 0.55 + sh - 0.1;
    g.add(neck);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.24, 0.3, relief + 0.18), goldMat);
    cap.position.y = 0.55 + sh + 0.14;
    g.add(cap);
    return g;
  }
  for (const p of layout.pilasters || []) scene.add(pilaster(p.x, p.z, p.yaw));

  // --- benches ---
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.7, metalness: 0, envMapIntensity: 0.3 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x29251f, roughness: 0.35, metalness: 0.5, envMapIntensity: 0.8 });
  for (const b of layout.benches || []) {
    const sx = b.axis === "z" ? b.width : b.length;
    const sz = b.axis === "z" ? b.length : b.width;
    const grp = new THREE.Group();
    grp.position.set(b.x, 0, b.z);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.16, sz), cushionMat);
    seat.position.y = b.height - 0.08;
    seat.castShadow = true;
    seat.receiveShadow = true;
    grp.add(seat);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.04, 0.04, sz + 0.04), goldMat);
    trim.position.y = b.height - 0.16;
    grp.add(trim);
    const lx = sx / 2 - 0.12;
    const lz = sz / 2 - 0.12;
    for (const [ox, oz] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, b.height - 0.2, 0.08), legMat);
      leg.position.set(ox, (b.height - 0.2) / 2, oz);
      leg.castShadow = true;
      grp.add(leg);
    }
    scene.add(grp);
  }

  // --- title wall signage (south wall centre) ---
  const sign = signTexture("Seaside", "BỘ SƯU TẬP ẢNH CƯỚI");
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
  signMesh.position.set(0, 2.3, D - 0.08);
  signMesh.rotation.y = Math.PI;
  scene.add(signMesh);
  const rule = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.035, 0.035), goldMat);
  rule.position.set(0, 1.35, D - 0.09);
  scene.add(rule);

  // --- lighting (key = sun through the skylight) ---
  scene.add(new THREE.HemisphereLight(0xeef2f0, 0xded8cb, 0.32));
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));

  const key = new THREE.DirectionalLight(0xfff4e6, 1.4);
  key.position.set(6, 26, 8);
  if (useShadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = Math.max(W, D) + 4;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe6eeec, 0.22);
  fill.position.set(-14, 14, -12);
  scene.add(fill);

  scene.background = new THREE.Color(0xe9e4db);
  scene.fog = new THREE.Fog(0xe6e8e3, 50, 120);

  return { floor, ceiling, goldMat };
}
