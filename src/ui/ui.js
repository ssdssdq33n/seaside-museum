// ---------------------------------------------------------------------------
//  DOM UI: intro/loader, artwork info panel, zone labels, crosshair state.
// ---------------------------------------------------------------------------

export class UI {
  constructor(total) {
    this.total = total;
    this.intro = document.getElementById("intro");
    this.loadfill = document.getElementById("loadfill");
    this.enterBtn = document.getElementById("enterBtn");
    this.hud = document.getElementById("hud");
    this.crosshair = document.getElementById("crosshair");
    this.zoneLabel = document.getElementById("zone-label");
    this.panel = document.getElementById("panel");
    this.panelClose = document.getElementById("panel-close");
    this.panelFull = document.getElementById("panel-full");
    this.helpBtn = document.getElementById("helpBtn");

    this.lightbox = document.getElementById("lightbox");
    this.lbImg = document.getElementById("lb-img");
    this.lbSpinner = document.getElementById("lb-spinner");
    this.lbStage = document.getElementById("lb-stage");
    this.lbTitle = document.getElementById("lb-title");
    this.lbSub = document.getElementById("lb-sub");
    this.lbClose = document.getElementById("lb-close");
    this.lbPrev = document.getElementById("lb-prev");
    this.lbNext = document.getElementById("lb-next");
    this.soundBtn = document.getElementById("soundBtn");
    this.minimap = document.getElementById("minimap");
    this.onLightboxNav = () => {};
    this._initZoom();

    this._zoneTimer = null;
    this._lastZone = null;

    this.panelClose.addEventListener("click", () => this.hidePanel());
    this.helpBtn.addEventListener("click", () => {
      this.intro.classList.remove("fade");
      this.intro.style.pointerEvents = "auto";
      if (this._onReopenIntro) this._onReopenIntro();
    });
  }

  setLoadProgress(pct) {
    this.loadfill.style.width = Math.round(pct * 100) + "%";
  }

  enableEnter(onEnter) {
    this.enterBtn.disabled = false;
    this.enterBtn.textContent = "Bước vào";
    this.enterBtn.addEventListener("click", () => {
      this.fadeOutIntro();
      onEnter();
    });
  }

  fadeOutIntro() {
    this.intro.classList.add("fade");
    this.intro.style.pointerEvents = "none";
    this.hud.classList.remove("hidden");
  }

  setCrosshairActive(active) {
    this.crosshair.classList.toggle("active", active);
  }

  showZone(zone) {
    if (!zone || zone === this._lastZone) return;
    this._lastZone = zone;
    this.zoneLabel.textContent = zone.name;
    this.zoneLabel.classList.add("show");
    clearTimeout(this._zoneTimer);
    this._zoneTimer = setTimeout(() => {
      this.zoneLabel.classList.remove("show");
    }, 2600);
  }

  showPanel(picture) {
    const i = picture.index;
    const p = picture.photo;
    this.panel.querySelector(".panel-index").textContent =
      `№ ${String(i + 1).padStart(2, "0")} / ${this.total}`;
    this.panel.querySelector(".panel-title").textContent =
      p.title || `Khoảnh khắc № ${String(i + 1).padStart(2, "0")}`;
    const capEl = this.panel.querySelector(".panel-caption");
    capEl.textContent = p.caption || "";
    capEl.style.display = p.caption ? "" : "none";
    this.panel.querySelector(".panel-meta").textContent =
      `${p.id} · ${p.orientation === "landscape" ? "Ảnh ngang" : "Ảnh dọc"}`;
    this.panel.classList.remove("hidden");
    requestAnimationFrame(() => this.panel.classList.add("open"));
  }

  hidePanel() {
    this.panel.classList.remove("open");
    if (this._onPanelClose) this._onPanelClose();
    setTimeout(() => this.panel.classList.add("hidden"), 480);
  }

  isPanelOpen() {
    return this.panel.classList.contains("open");
  }

  openLightbox(picture) {
    const p = picture.photo;
    this._resetZoom();
    this.lbImg.classList.remove("ready");
    this.lbSpinner.style.display = "block";
    this.lbTitle.textContent =
      p.title || `Khoảnh khắc № ${String(picture.index + 1).padStart(2, "0")}`;
    this.lbSub.textContent =
      (p.caption ? p.caption + "  ·  " : "") +
      `№ ${String(picture.index + 1).padStart(2, "0")} / ${this.total}`;
    this.lbImg.onload = () => {
      this.lbSpinner.style.display = "none";
      this.lbImg.classList.add("ready");
    };
    // show the lower-res first for instant feedback, then swap to full-res
    this.lbImg.src = p.full;
    const hi = new Image();
    hi.onload = () => {
      this.lbImg.src = p.orig || p.full;
    };
    hi.src = p.orig || p.full;
    this.lightbox.classList.remove("hidden");
    requestAnimationFrame(() => this.lightbox.classList.add("open"));
  }

  closeLightbox() {
    this.lightbox.classList.remove("open");
    setTimeout(() => {
      this.lightbox.classList.add("hidden");
      this.lbImg.src = "";
      this._resetZoom();
    }, 400);
  }

  isLightboxOpen() {
    return this.lightbox.classList.contains("open");
  }

  // ---- zoom / pan (wheel, drag, pinch, double-tap) ----
  _resetZoom() {
    this._zoom = { scale: 1, tx: 0, ty: 0 };
    this._applyZoom();
    this.lbImg.classList.remove("zoomed");
  }
  _applyZoom() {
    const z = this._zoom;
    this.lbImg.style.transform = `translate(${z.tx}px, ${z.ty}px) scale(${z.scale})`;
    this.lbImg.classList.toggle("zoomed", z.scale > 1.01);
  }
  _initZoom() {
    this._zoom = { scale: 1, tx: 0, ty: 0 };
    const stage = this.lbStage;
    const img = this.lbImg;
    const clampScale = (s) => Math.min(5, Math.max(1, s));

    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const prev = this._zoom.scale;
      this._zoom.scale = clampScale(prev * (e.deltaY < 0 ? 1.15 : 0.87));
      if (this._zoom.scale === 1) {
        this._zoom.tx = this._zoom.ty = 0;
      }
      this._applyZoom();
    }, { passive: false });

    let last = 0;
    img.addEventListener("dblclick", () => {
      this._zoom.scale = this._zoom.scale > 1.01 ? 1 : 2.4;
      this._zoom.tx = this._zoom.ty = 0;
      this._applyZoom();
    });

    // pointer drag + pinch
    const pts = new Map();
    let startDist = 0;
    let startScale = 1;
    let startTx = 0;
    let startTy = 0;
    stage.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      startTx = this._zoom.tx;
      startTy = this._zoom.ty;
      startScale = this._zoom.scale;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        startDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      // double-tap (touch)
      const now = performance.now();
      if (e.pointerType === "touch" && now - last < 300) {
        this._zoom.scale = this._zoom.scale > 1.01 ? 1 : 2.4;
        this._zoom.tx = this._zoom.ty = 0;
        this._applyZoom();
      }
      last = now;
    });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        this._zoom.scale = clampScale(startScale * (d / (startDist || d)));
        this._applyZoom();
      } else if (this._zoom.scale > 1.01) {
        this._zoom.tx += dx;
        this._zoom.ty += dy;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this._applyZoom();
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (this._zoom.scale <= 1.01) {
        this._zoom.tx = this._zoom.ty = 0;
        this._applyZoom();
      }
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
  }
}
