// ---------------------------------------------------------------------------
//  Builds framed artworks from the layout and lazy-loads their textures.
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { labelTexture } from "../museum/textures.js";

const loader = new THREE.TextureLoader();

export function createFrames(scene, layout, renderer) {
  const c = layout.config;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // dark walnut (gallery) & antique-gold (hero) moldings, warm mat, gilt slips
  const frameMatM = new THREE.MeshStandardMaterial({ color: 0x241f19, roughness: 0.42, metalness: 0.25, envMapIntensity: 0.9 });
  const frameMatL = new THREE.MeshStandardMaterial({ color: 0x9c7f49, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.1 });
  const bevelMatM = new THREE.MeshStandardMaterial({ color: 0x3b3025, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.8 });
  const bevelMatL = new THREE.MeshStandardMaterial({ color: 0x7c6236, roughness: 0.45, metalness: 0.8, envMapIntensity: 1.0 });
  const matboard = new THREE.MeshStandardMaterial({ color: 0xf8f5ef, roughness: 0.92, metalness: 0, envMapIntensity: 0.25 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc2a469, roughness: 0.3, metalness: 0.95, envMapIntensity: 1.1 });
  const brassMat = goldMat;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffe6b0, emissiveIntensity: 0.6, roughness: 1 });

  const pictures = [];
  const raycastTargets = [];

  for (const f of layout.frames) {
    const group = new THREE.Group();
    group.position.set(f.x, f.y, f.z);
    group.rotation.y = f.rotY; // local +z == outward normal

    const fil = f.fillet;
    const matB = f.mat;
    const frB = f.frame;
    const innerW = f.imgW + 2 * fil; // image + brass fillet
    const innerH = f.imgH + 2 * fil;
    const boardW = innerW + 2 * matB; // + mat board
    const boardH = innerH + 2 * matB;
    const outerW = boardW + 2 * frB; // + outer molding
    const outerH = boardH + 2 * frB;
    const isHero = f.size === "L";
    const frameMat = isHero ? frameMatL : frameMatM;
    const bevelMat = isHero ? bevelMatL : bevelMatM;
    const depth = isHero ? 0.14 : 0.1;

    // outer molding (deep, catches light)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(outerW, outerH, depth), frameMat);
    frame.castShadow = true;
    frame.receiveShadow = true;
    group.add(frame);
    // thin raised lip around the opening, just proud of the molding face
    const lip = new THREE.Mesh(new THREE.BoxGeometry(boardW + frB * 1.1, boardH + frB * 1.1, depth + 0.03), bevelMat);
    group.add(lip);

    // gilt slip between molding and mat
    const slip = new THREE.Mesh(new THREE.PlaneGeometry(boardW + frB * 0.7, boardH + frB * 0.7), goldMat);
    slip.position.z = depth / 2 + 0.03;
    group.add(slip);

    // mat board (sits in front of the slip)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(boardW, boardH), matboard);
    mat.position.z = depth / 2 + 0.045;
    group.add(mat);

    // brass fillet around the image
    const brass = new THREE.Mesh(new THREE.PlaneGeometry(innerW, innerH), brassMat);
    brass.position.z = depth / 2 + 0.06;
    group.add(brass);

    // image (unlit so the photo reads true-to-colour, like a lightbox print)
    const imgMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(f.photo.color || "#9aa8aa"),
      toneMapped: false,
    });
    const img = new THREE.Mesh(new THREE.PlaneGeometry(f.imgW, f.imgH), imgMat);
    img.position.z = depth / 2 + 0.075;
    img.userData.pictureIndex = f.index;
    group.add(img);
    raycastTargets.push(img);

    // brass picture light above the frame (decorative fixture)
    const armLen = Math.min(0.5, outerH * 0.18 + 0.2);
    const topY = outerH / 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, armLen, 10), brassMat);
    arm.position.set(0, topY + armLen / 2, 0.02);
    group.add(arm);
    const shadeW = Math.min(outerW * 0.55, 1.1);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, shadeW, 14), brassMat);
    shade.rotation.z = Math.PI / 2;
    shade.position.set(0, topY + armLen, 0.22);
    group.add(shade);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(shadeW * 0.8, 0.05), lampMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(0, topY + armLen - 0.055, 0.22);
    group.add(glow);

    // label plate beneath the frame
    const title = f.photo.title || `Khoảnh khắc № ${String(f.index + 1).padStart(2, "0")}`;
    const sub = f.photo.caption || f.photo.id;
    const labelTex = labelTexture(title, sub);
    labelTex.anisotropy = Math.min(4, maxAniso);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.145),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
    );
    label.position.set(outerW / 2 - 0.29, -(outerH / 2) - 0.22, 0.04);
    group.add(label);

    scene.add(group);

    const picture = {
      index: f.index,
      photo: f.photo,
      group,
      imgMesh: img,
      imgMat,
      viewpoint: f.viewpoint,
      worldPos: new THREE.Vector3(f.x, f.y, f.z),
      loaded: false,
      loading: false,
      tier: null, // null | "web" | "full"
    };

    const applyTex = (tex, tier) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso; // sharp at grazing angles
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      const prev = imgMat.map;
      imgMat.map = tex;
      imgMat.color.set(0xffffff);
      imgMat.needsUpdate = true;
      if (prev) prev.dispose();
      picture.tier = tier;
    };

    const loadTier = (url, tier) =>
      new Promise((resolve) => {
        if (picture.loading) return resolve();
        picture.loading = true;
        loader.load(
          url,
          (tex) => {
            applyTex(tex, tier);
            picture.loaded = true;
            picture.loading = false;
            resolve();
          },
          undefined,
          () => {
            picture.loading = false;
            resolve();
          }
        );
      });

    // wall version (crisp). Skips if already at web or full tier.
    picture.load = () =>
      picture.tier === "web" || picture.tier === "full"
        ? Promise.resolve()
        : loadTier(f.photo.web, "web");

    // near-original, used when the visitor focuses this artwork.
    picture.loadFull = () =>
      picture.tier === "full" ? Promise.resolve() : loadTier(f.photo.full, "full");

    // free GPU memory for distant artworks, dropping back to the placeholder.
    picture.unload = () => {
      if (!picture.loaded || picture.loading) return;
      if (imgMat.map) {
        imgMat.map.dispose();
        imgMat.map = null;
      }
      imgMat.color.set(new THREE.Color(f.photo.color || "#9aa8aa"));
      imgMat.needsUpdate = true;
      picture.loaded = false;
      picture.tier = null;
    };

    pictures.push(picture);
  }

  return { pictures, raycastTargets };
}
