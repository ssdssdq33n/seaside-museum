// Headless render verification: loads the built site, enters the museum,
// captures console/page errors, and shoots several vantage points.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), ".verify");
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || "http://localhost:4173";

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });

// wait for the Enter button to be enabled (preload finished)
await page.waitForFunction(() => {
  const b = document.getElementById("enterBtn");
  return b && !b.disabled;
}, { timeout: 45000 });

await page.screenshot({ path: path.join(OUT, "0-intro.png") });

await page.click("#enterBtn");
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(OUT, "1-spawn.png") });

// WebGL health + scene content report
const report = await page.evaluate(() => {
  const gl = document.getElementById("scene").getContext("webgl2") ||
    document.getElementById("scene").getContext("webgl");
  const app = window.__app;
  return {
    webgl: !!gl,
    renderer: gl ? gl.getParameter(gl.VERSION) : null,
    pictures: app ? app.pictures.length : -1,
    loaded: app ? app.pictures.filter((p) => p.loaded).length : -1,
    sceneChildren: app ? app.scene.children.length : -1,
    spawn: app ? [app.player.pos.x, app.player.pos.z] : null,
  };
});

// A few curated vantage points to eyeball the layout.
const shots = [
  { name: "2-north-wall", x: 0, z: -16, yaw: 0 },
  { name: "3-east-wing", x: 24, z: 0, yaw: -Math.PI / 2 },
  { name: "4-west-wing", x: -24, z: 0, yaw: Math.PI / 2 },
  { name: "5-feature", x: 0, z: 9, yaw: 0 },
  { name: "6-title-wall", x: 0, z: 12, yaw: Math.PI },
  { name: "7-overview", x: 26, z: 16, yaw: -2.3 },
  { name: "9-bench", x: 8, z: 6, yaw: -1.1 },
];
for (const s of shots) {
  await page.evaluate((s) => window.__app.look(s.x, s.z, s.yaw), s);
  await page.waitForTimeout(1300); // let nearby textures stream in
  await page.screenshot({ path: path.join(OUT, s.name + ".png") });
}

// focus an artwork (glide + info panel). Reset to spawn first for a clean glide.
await page.evaluate(() => {
  const a = window.__app;
  a.look(a.layout.spawn.x, a.layout.spawn.z, a.layout.spawn.yaw);
});
await page.waitForTimeout(300);
await page.evaluate(() => window.__app.focusPicture(window.__app.pictures[13]));
await page.waitForTimeout(6000); // glide (0.95s) + full-res stream
await page.screenshot({ path: path.join(OUT, "8-focus-panel.png") });

const focusState = await page.evaluate(() => {
  const a = window.__app;
  const p = a.pictures[13];
  return {
    tier: p.tier,
    camPos: [+a.player.pos.x.toFixed(2), +a.player.pos.z.toFixed(2)],
    viewpoint: [+p.viewpoint.x.toFixed(2), +p.viewpoint.z.toFixed(2)],
    camYaw: +a.player.yaw.toFixed(3),
    targetYaw: +p.viewpoint.yaw.toFixed(3),
  };
});
const loadedNow = await page.evaluate(() => window.__app.pictures.filter((p) => p.loaded).length);

// open the full-image lightbox (the F-key feature)
await page.evaluate(() => window.__app.openLightbox(window.__app.pictures[13]));
await page.waitForFunction(() => {
  const img = document.getElementById("lb-img");
  return img && img.classList.contains("ready");
}, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, "10-lightbox.png") });
const lbState = await page.evaluate(() => {
  const img = document.getElementById("lb-img");
  return { open: document.getElementById("lightbox").classList.contains("open"), natural: [img.naturalWidth, img.naturalHeight] };
});

console.log(JSON.stringify({ ...report, focusState, lbState, loadedNow, errors }, null, 2));

await browser.close();
if (errors.length) process.exit(2);
