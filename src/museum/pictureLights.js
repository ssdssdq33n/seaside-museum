// ---------------------------------------------------------------------------
//  A small pool of real spotlights that dynamically light the artworks nearest
//  the visitor — the warm "wall-wash" pools of a real gallery, without paying
//  for one light per frame.
// ---------------------------------------------------------------------------
import * as THREE from "three";

export class PictureLights {
  constructor(scene, frames, count = 8) {
    this.frames = frames.map((f) => ({
      pos: new THREE.Vector3(f.x, f.y, f.z),
      normal: new THREE.Vector3(f.normal[0], 0, f.normal[1]),
      size: f.size,
    }));
    this.lamps = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.SpotLight(0xffe9c6, 0, 9, Math.PI / 7, 0.6, 1.4);
      light.visible = false;
      const target = new THREE.Object3D();
      scene.add(light);
      scene.add(target);
      light.target = target;
      this.lamps.push({ light, target, frameIndex: -1 });
    }
    this._tmp = new THREE.Vector3();
  }

  update(cameraPos) {
    // rank frames by distance, assign the nearest ones to the lamp pool
    const ranked = this.frames
      .map((f, i) => ({ i, d2: f.pos.distanceToSquared(cameraPos) }))
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, this.lamps.length);

    for (let k = 0; k < this.lamps.length; k++) {
      const lamp = this.lamps[k];
      const entry = ranked[k];
      if (!entry || entry.d2 > 26 * 26) {
        lamp.light.visible = false;
        continue;
      }
      const f = this.frames[entry.i];
      // lamp sits a touch in front of and above the frame, aimed at it
      lamp.light.position.copy(f.pos).addScaledVector(f.normal, 1.1);
      lamp.light.position.y = f.pos.y + (f.size === "L" ? 1.7 : 1.35);
      lamp.target.position.copy(f.pos).addScaledVector(f.normal, 0.05);
      lamp.target.position.y = f.pos.y - 0.1;

      // fade with distance
      const d = Math.sqrt(entry.d2);
      const intensity = Math.max(0, 1 - d / 26) * (f.size === "L" ? 10 : 7);
      lamp.light.intensity = intensity;
      lamp.light.visible = intensity > 0.05;
    }
  }
}
