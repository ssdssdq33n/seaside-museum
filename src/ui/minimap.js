// ---------------------------------------------------------------------------
//  Minimap: a top-down plan of the hall showing walls, artworks and the
//  visitor's position + facing. Drawn to a small canvas overlay.
// ---------------------------------------------------------------------------

export class Minimap {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.layout = layout;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = canvas.width;
    this.h = canvas.height;
    canvas.width = this.w * dpr;
    canvas.height = this.h * dpr;
    this.ctx.scale(dpr, dpr);

    const b = layout.bounds;
    this.pad = 12;
    const sx = (this.w - 2 * this.pad) / (b.maxX - b.minX);
    const sz = (this.h - 2 * this.pad) / (b.maxZ - b.minZ);
    this.s = Math.min(sx, sz);
    this.ox = this.w / 2;
    this.oz = this.h / 2;
  }

  // world (x,z) -> canvas (px,py). Centre of hall maps to canvas centre.
  _p(x, z) {
    return [this.ox + x * this.s, this.oz + z * this.s];
  }

  draw(px, pz, yaw) {
    const ctx = this.ctx;
    const L = this.layout;
    ctx.clearRect(0, 0, this.w, this.h);

    // outer walls
    const b = L.bounds;
    const [x0, z0] = this._p(b.minX, b.minZ);
    const [x1, z1] = this._p(b.maxX, b.maxZ);
    ctx.strokeStyle = "rgba(242,236,225,0.65)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, z0, x1 - x0, z1 - z0);

    // interior walls
    ctx.fillStyle = "rgba(242,236,225,0.5)";
    for (const w of L.walls) {
      const [cx, cz] = this._p(w.cx, w.cz);
      const ww = Math.max(2, w.w * this.s);
      const wd = Math.max(2, w.d * this.s);
      if (w.accent) ctx.fillStyle = "rgba(111,155,160,0.85)";
      else ctx.fillStyle = "rgba(242,236,225,0.5)";
      ctx.fillRect(cx - ww / 2, cz - wd / 2, ww, wd);
    }

    // artworks
    ctx.fillStyle = "rgba(194,164,105,0.95)";
    for (const f of L.frames) {
      const [fx, fz] = this._p(f.x, f.z);
      ctx.beginPath();
      ctx.arc(fx, fz, f.size === "L" ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // player
    const [cx, cz] = this._p(px, pz);
    // forward = (−sin yaw, −cos yaw); on the map, +z is downward
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(Math.atan2(fx, -fz)); // orient triangle to facing
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
