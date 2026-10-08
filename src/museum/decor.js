// ---------------------------------------------------------------------------
//  Decorative dressing: potted trees, marble pedestals with bouquets, rugs,
//  and brass pendant lights. Purely visual (low-poly, static).
// ---------------------------------------------------------------------------
import * as THREE from "three";

const potMat = new THREE.MeshStandardMaterial({ color: 0x343029, roughness: 0.9, metalness: 0.05, envMapIntensity: 0.4 });
const soilMat = new THREE.MeshStandardMaterial({ color: 0x241f1a, roughness: 1 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5a46, roughness: 0.9 });
const marbleMat = new THREE.MeshStandardMaterial({ color: 0xeae6de, roughness: 0.38, metalness: 0, envMapIntensity: 0.6 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc2a469, roughness: 0.3, metalness: 0.95, envMapIntensity: 1 });
const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffdfa6, emissiveIntensity: 0.9, roughness: 1 });

const leafGreens = [0x6f7f5e, 0x7d8a66, 0x617153, 0x5c6a4e];

function sphere(r, color, rough = 1) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 1),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.3 })
  );
}

// An elegant potted olive-style tree.
function plant(x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.2 * scale, 0.52 * scale, 20), potMat);
  pot.position.y = 0.26 * scale;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.24 * scale, 0.04, 16), soilMat);
  soil.position.y = 0.5 * scale;
  g.add(soil);

  const trunkH = 0.9 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.05 * scale, trunkH, 8), trunkMat);
  trunk.position.y = 0.5 * scale + trunkH / 2;
  g.add(trunk);

  const crownY = 0.5 * scale + trunkH;
  const blobs = 6;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2;
    const r = 0.22 * scale + (i % 2) * 0.08 * scale;
    const leaf = sphere(0.26 * scale + 0.06 * scale * (i % 3), leafGreens[i % leafGreens.length]);
    leaf.position.set(Math.cos(a) * r * 0.6, crownY + 0.1 * scale + (i % 3) * 0.14 * scale, Math.sin(a) * r * 0.6);
    leaf.castShadow = true;
    g.add(leaf);
  }
  const top = sphere(0.3 * scale, leafGreens[1]);
  top.position.y = crownY + 0.42 * scale;
  g.add(top);
  return g;
}

// A marble pedestal topped with a soft bouquet.
function pedestal(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), marbleMat);
  base.position.y = 0.04;
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.92, 20), marbleMat);
  col.position.y = 0.5;
  col.castShadow = true;
  g.add(col);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.44), marbleMat);
  cap.position.y = 0.97;
  g.add(cap);

  // vase + flowers
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.22, 16), brassMat);
  vase.position.y = 1.11;
  g.add(vase);
  const blooms = [0xf6f0e7, 0xeccfc6, 0xf6f0e7, 0xe7d9cf, 0xf1e3da];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.1 + (i % 2) * 0.05;
    const b = sphere(0.055 + 0.02 * (i % 3), blooms[i % blooms.length], 0.8);
    b.position.set(Math.cos(a) * r, 1.28 + 0.05 * (i % 3), Math.sin(a) * r);
    g.add(b);
    if (i % 3 === 0) {
      const leaf = sphere(0.05, 0x7d8a66);
      leaf.position.set(Math.cos(a + 0.3) * (r + 0.05), 1.22, Math.sin(a + 0.3) * (r + 0.05));
      g.add(leaf);
    }
  }
  return g;
}

function rug(x, z, w, d, inner, border) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const b = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: border, roughness: 0.95, metalness: 0, envMapIntensity: 0.1 })
  );
  b.rotation.x = -Math.PI / 2;
  b.position.y = 0.05;
  b.receiveShadow = true;
  g.add(b);
  const inr = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.5, d - 0.5),
    new THREE.MeshStandardMaterial({ color: inner, roughness: 0.95, metalness: 0, envMapIntensity: 0.1 })
  );
  inr.rotation.x = -Math.PI / 2;
  inr.position.y = 0.055;
  g.add(inr);
  return g;
}

// A brass drum pendant hanging from the ceiling.
function pendant(x, z, ceilingY, drop = 1.6) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, drop, 8), brassMat);
  rod.position.y = ceilingY - drop / 2;
  g.add(rod);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 24, 1, true), brassMat);
  drum.position.y = ceilingY - drop;
  g.add(drum);
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), lampMat);
  bulb.position.y = ceilingY - drop - 0.12;
  g.add(bulb);
  return g;
}

export function addDecor(scene, layout) {
  const c = layout.config;
  const W = c.wallX;
  const D = c.wallZ;
  const H = c.wallHeight;

  // Rugs — a feature rug in the central Moments area, a runner at the entrance.
  scene.add(rug(0, 3.0, 9.0, 7.5, 0xaebcbb, 0x566e70));
  scene.add(rug(0, D - 5.5, 3.0, 6.0, 0xc9c0b2, 0x8c8172));

  // Pedestals flanking the central feature wall and at the wing thresholds.
  scene.add(pedestal(-8.6, 4.0));
  scene.add(pedestal(8.6, 4.0));
  scene.add(pedestal(-12.5, 7.5));
  scene.add(pedestal(12.5, 7.5));

  // Potted trees: flanking the entrance, the four corners, and the wings.
  const ins = 2.6;
  const spots = [
    [-4.6, D - 3.0, 1.3], [4.6, D - 3.0, 1.3],
    [-W + ins, D - ins, 1.1], [W - ins, D - ins, 1.1],
    [-W + ins, -D + ins, 1.1], [W - ins, -D + ins, 1.1],
    [-26, 8.5, 1.0], [26, 8.5, 1.0],
    [-26, -8.5, 1.0], [26, -8.5, 1.0],
    [-10.5, -12, 0.95], [10.5, -12, 0.95],
  ];
  for (const [x, z, s] of spots) scene.add(plant(x, z, s));

  // Pendant lights down the hall aisles + a warm glow at the centre.
  for (const [x, z] of [
    [-20, 12], [20, 12], [-20, -14], [20, -14],
    [-24, 0], [24, 0], [0, 14], [0, -18],
  ]) {
    scene.add(pendant(x, z, H, 2.2));
  }
  // (central warmth comes from the chandelier in building.js)
  const warm2 = new THREE.PointLight(0xfff0d8, 20, 30, 2.0);
  warm2.position.set(0, H - 2.4, -12);
  scene.add(warm2);
}
