// ---------------------------------------------------------------------------
//  Procedural canvas textures — warm plaster walls, sandstone floor, signage.
//  Self-contained (no image assets needed for the architecture itself).
// ---------------------------------------------------------------------------
import * as THREE from "three";

function canvas(size) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  return cv;
}

// subtle value noise overlay
function grain(ctx, size, amount, scale = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function plasterTexture() {
  const size = 512;
  const cv = canvas(size);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#efeae1";
  ctx.fillRect(0, 0, size, size);
  // faint broad mottling
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 60 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.03 + Math.random() * 0.03;
    g.addColorStop(0, `rgba(210,205,194,${a})`);
    g.addColorStop(1, "rgba(210,205,194,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  grain(ctx, size, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Checkerboard marble. Rotate the texture 45° on the floor for a diamond lay.
export function floorTexture() {
  const size = 512;
  const cv = canvas(size);
  const ctx = cv.getContext("2d");
  const half = size / 2;
  const tones = [
    ["#efeae0", "#e3dccf", "rgba(190,180,162,0.22)"], // cream marble
    ["#cdc3b2", "#c0b5a2", "rgba(150,138,120,0.26)"], // greige marble
  ];
  const drawTile = (ox, oy, t) => {
    const [base, base2, vein] = t;
    const g = ctx.createLinearGradient(ox, oy, ox + half, oy + half);
    g.addColorStop(0, base);
    g.addColorStop(1, base2);
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, half, half);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, half, half);
    ctx.clip();
    ctx.strokeStyle = vein;
    ctx.lineWidth = 1.2;
    for (let v = 0; v < 7; v++) {
      ctx.beginPath();
      ctx.moveTo(ox + Math.random() * half, oy);
      ctx.bezierCurveTo(
        ox + Math.random() * half, oy + Math.random() * half,
        ox + Math.random() * half, oy + Math.random() * half,
        ox + Math.random() * half, oy + half
      );
      ctx.stroke();
    }
    ctx.restore();
  };
  // 2x2 checker (repeats seamlessly)
  drawTile(0, 0, tones[0]);
  drawTile(half, 0, tones[1]);
  drawTile(0, half, tones[1]);
  drawTile(half, half, tones[0]);
  // thin grout
  ctx.strokeStyle = "rgba(120,110,95,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, half, half);
  ctx.strokeRect(half, 0, half, half);
  ctx.strokeRect(0, half, half, half);
  ctx.strokeRect(half, half, half, half);
  grain(ctx, size, 5);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

// A text sign rendered to a transparent canvas (used on the title wall).
export function signTexture(title, subtitle) {
  const w = 1024;
  const h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#2b2f31";
  ctx.font = "500 150px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(title, w / 2, h / 2 - 30);

  ctx.fillStyle = "#3f6d72";
  ctx.font = "300 46px 'Jost', sans-serif";
  ctx.letterSpacing = "10px";
  ctx.fillText(subtitle, w / 2, h / 2 + 90);

  // thin rule
  ctx.strokeStyle = "rgba(63,109,114,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 120, h / 2 + 40);
  ctx.lineTo(w / 2 + 120, h / 2 + 40);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Small label plate shown under each artwork.
export function labelTexture(line1, line2) {
  const w = 512;
  const h = 128;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(63,109,114,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, w - 6, h - 6);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#2b2f31";
  ctx.font = "600 40px 'Jost', sans-serif";
  ctx.fillText(line1, 28, 46);
  ctx.fillStyle = "#6b716f";
  ctx.font = "300 30px 'Jost', sans-serif";
  ctx.fillText(line2, 28, 92);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
