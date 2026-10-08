// ---------------------------------------------------------------------------
//  Seaside — a 3D web museum for seaside wedding photography.
//  Entry point: builds the scene and drives the render loop.
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

import photosData from "./data/photos.json";
import { buildLayout, CONFIG } from "./gallery/layout.js";
import { zoneAt } from "./gallery/collision.js";
import { createMuseum } from "./museum/building.js";
import { addDecor } from "./museum/decor.js";
import { PictureLights } from "./museum/pictureLights.js";
import { createFrames } from "./gallery/frames.js";
import { Player } from "./controls/player.js";
import { isTouchDevice, setupTouch } from "./controls/touch.js";
import { UI } from "./ui/ui.js";
import { Minimap } from "./ui/minimap.js";
import { Ambient } from "./audio/ambient.js";

const LOAD_RADIUS = 32; // metres: stream an artwork's crisp texture within this range
const MAX_LOADED = 11; // cap simultaneously-loaded textures (GPU memory budget)
const LOADS_PER_TICK = 4; // smooth out network bursts
const FOCUS_MAX_DIST = 34; // how far the aiming ray reaches

async function init() {
  const photos = photosData.photos;
  const layout = buildLayout(photos, CONFIG);
  const ui = new UI(photos.length);

  // --- renderer ---
  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true, // eliminates coplanar z-fighting / flicker
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.xr.enabled = true;

  const touch = isTouchDevice();
  if (!touch) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    250
  );

  // Wait for webfonts so canvas-drawn signage/labels use the right typefaces.
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) {
    /* ignore */
  }

  // --- world ---
  createMuseum(scene, layout, renderer, { shadows: !touch, reflections: !touch });
  addDecor(scene, layout);
  const { pictures, raycastTargets } = createFrames(scene, layout, renderer);
  const pictureLights = new PictureLights(scene, layout.frames, touch ? 4 : 8);
  const minimap = new Minimap(ui.minimap, layout);
  const ambient = new Ambient();

  // static scene: render the shadow map once, then stop updating it.
  if (!touch) {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  }

  // --- player & input ---
  const player = new Player(camera, canvas, layout);

  const raycaster = new THREE.Raycaster();
  const centerNDC = new THREE.Vector2(0, 0);
  let hovered = null;

  function pictureFromHit(hits) {
    for (const h of hits) {
      if (h.object.userData.pictureIndex !== undefined && h.distance < FOCUS_MAX_DIST) {
        return pictures[h.object.userData.pictureIndex];
      }
    }
    return null;
  }

  let focusedPicture = null;
  function focusPicture(pic) {
    if (!pic) return;
    focusedPicture = pic;
    player.glideTo(pic.viewpoint);
    pic.load().then(() => pic.loadFull()); // crisp now, near-original a moment later
    ui.showPanel(pic);
    if (!touch && document.exitPointerLock) document.exitPointerLock();
  }
  // show the info sidebar (with the "view full" button) without walking
  function openSidebar(pic) {
    if (!pic) return;
    focusedPicture = pic;
    pic.load();
    ui.showPanel(pic);
    if (!touch && document.exitPointerLock) document.exitPointerLock();
  }

  // close panel -> let desktop users re-lock by clicking
  ui._onPanelClose = () => {};

  // --- full-image zoom lightbox (right-click / tap / panel button) ---
  let currentLightbox = null;
  function openLightbox(pic) {
    if (!pic) return;
    currentLightbox = pic;
    pic.loadFull();
    ui.openLightbox(pic);
    player.enabled = false;
    player.setAnalog(0, 0);
    if (!touch && document.exitPointerLock) document.exitPointerLock();
  }
  function closeLightbox() {
    ui.closeLightbox();
    currentLightbox = null;
    player.enabled = true;
  }
  function stepLightbox(dir) {
    if (!currentLightbox) return;
    const n = pictures.length;
    openLightbox(pictures[(currentLightbox.index + dir + n) % n]);
  }
  ui.lbClose.addEventListener("click", closeLightbox);
  ui.lbPrev.addEventListener("click", () => stepLightbox(-1));
  ui.lbNext.addEventListener("click", () => stepLightbox(1));
  ui.panelFull.addEventListener("click", () => openLightbox(focusedPicture));

  // desktop: right-click opens the info sidebar; its button opens the zoom dialog
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (touch) return;
    if (ui.isLightboxOpen()) return closeLightbox();
    const target = (player.locked && hovered) || focusedPicture;
    if (target) openSidebar(target);
  });
  window.addEventListener("keydown", (e) => {
    if (!ui.isLightboxOpen()) return;
    if (e.code === "Escape") closeLightbox();
    else if (e.code === "ArrowLeft") stepLightbox(-1);
    else if (e.code === "ArrowRight") stepLightbox(1);
  });

  // --- desktop: pointer lock + click to focus ---
  if (!touch) {
    canvas.addEventListener("click", () => {
      if (ui.isPanelOpen()) return;
      if (!player.locked) player.requestLock();
    });
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // left-click only; right-click = sidebar
      if (player.locked && hovered) focusPicture(hovered);
    });
  } else {
    // --- mobile: joystick + drag-look + tap to focus ---
    setupTouch(player, canvas, (x, y) => {
      const ndc = new THREE.Vector2(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const pic = pictureFromHit(raycaster.intersectObjects(raycastTargets, false));
      if (pic) openSidebar(pic); // tap an artwork -> info sidebar (then "view full")
    });
  }

  // --- VR ---
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
      if (ok) {
        const vrBtn = VRButton.createButton(renderer);
        vrBtn.style.position = "fixed";
        vrBtn.style.bottom = "24px";
        vrBtn.style.right = "24px";
        vrBtn.style.left = "auto";
        vrBtn.style.zIndex = "25";
        document.body.appendChild(vrBtn);
      }
    });
  }

  // --- preload nearest artworks for the loading bar ---
  const spawnPos = new THREE.Vector3(layout.spawn.x, 0, layout.spawn.z);
  const nearest = [...pictures].sort(
    (a, b) =>
      a.worldPos.distanceToSquared(spawnPos) - b.worldPos.distanceToSquared(spawnPos)
  );
  const preloadN = Math.min(12, nearest.length);
  let done = 0;
  ui.setLoadProgress(0.04);
  await Promise.all(
    nearest.slice(0, preloadN).map((p) =>
      p.load().then(() => {
        done++;
        ui.setLoadProgress(0.04 + 0.96 * (done / preloadN));
      })
    )
  );
  ui.setLoadProgress(1);

  // sound toggle
  ui.soundBtn.addEventListener("click", () => {
    const on = ambient.toggle();
    ui.soundBtn.classList.toggle("off", !on);
    ui.soundBtn.textContent = on ? "♪" : "♪̶";
  });

  async function enterMobile() {
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
    } catch (e) {
      /* orientation lock not supported (e.g. iOS) — the rotate prompt covers it */
    }
  }

  ui.enableEnter(() => {
    player.enabled = true;
    try {
      ambient.start();
    } catch (e) {
      /* audio not available */
    }
    ui.minimap.classList.remove("hidden");
    if (!touch) player.requestLock();
    else enterMobile();
  });

  // --- resize ---
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Debug/verification hook (harmless in production).
  window.__app = {
    player,
    pictures,
    layout,
    camera,
    scene,
    focusPicture,
    openLightbox,
    look(x, z, yaw, pitch = 0) {
      player.cancelGlide();
      player.pos.set(x, player.eye, z);
      player.yaw = yaw;
      player.pitch = pitch;
      player._apply();
    },
  };

  // --- main loop ---
  const clock = new THREE.Clock();
  let lazyAccum = 0;
  let mapAccum = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());

    if (player.enabled && !renderer.xr.isPresenting) {
      player.update(dt);

      // center-ray hover (desktop aiming)
      if (!touch && player.locked) {
        raycaster.setFromCamera(centerNDC, camera);
        hovered = pictureFromHit(raycaster.intersectObjects(raycastTargets, false));
        ui.setCrosshairActive(!!hovered);
      } else {
        ui.setCrosshairActive(false);
      }

      // zone label by position
      ui.showZone(zoneAt(player.pos.x, player.pos.z, layout.zones));

      // warm gallery lights follow the nearest artworks
      pictureLights.update(player.pos);

      // minimap (throttled)
      mapAccum += dt;
      if (mapAccum > 0.08) {
        mapAccum = 0;
        minimap.draw(player.pos.x, player.pos.z, player.yaw);
      }
    }

    // stream textures: keep the nearest MAX_LOADED artworks crisp, free the rest
    lazyAccum += dt;
    if (lazyAccum > 0.25) {
      lazyAccum = 0;
      const px = player.pos.x;
      const pz = player.pos.z;
      const ranked = pictures
        .map((p) => {
          const dx = p.worldPos.x - px;
          const dz = p.worldPos.z - pz;
          return { p, d2: dx * dx + dz * dz };
        })
        .sort((a, b) => a.d2 - b.d2);

      let started = 0;
      const r2 = LOAD_RADIUS * LOAD_RADIUS;
      ranked.forEach(({ p, d2 }, rank) => {
        const keep = rank < MAX_LOADED && d2 < r2;
        if (keep) {
          if (!p.loaded && !p.loading && started < LOADS_PER_TICK) {
            p.load();
            started++;
          }
        } else if (p !== focusedPicture) {
          p.unload();
        }
      });
    }

    renderer.render(scene, camera);
  });
}

init();
