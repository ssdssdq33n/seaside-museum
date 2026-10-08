// ---------------------------------------------------------------------------
//  Player controller: first-person look + walk, bounded by collision, with a
//  smooth "glide to viewpoint" when an artwork is selected.
//  Works with mouse (pointer lock) and is fed analog input by the touch module.
// ---------------------------------------------------------------------------
import * as THREE from "three";
import { resolve } from "../gallery/collision.js";

const SPEED = 3.4; // metres / second
const ACCEL = 12;
const LOOK_SENS = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.12;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Player {
  constructor(camera, dom, layout) {
    this.camera = camera;
    this.dom = dom;
    this.layout = layout;
    this.radius = layout.config.playerRadius;
    this.eye = layout.config.eyeHeight;

    this.pos = new THREE.Vector3(layout.spawn.x, this.eye, layout.spawn.z);
    this.yaw = layout.spawn.yaw;
    this.pitch = 0;
    this.vel = new THREE.Vector3();

    this.keys = { f: false, b: false, l: false, r: false };
    this.analog = { x: 0, y: 0 }; // from touch joystick, −1..1
    this.enabled = false;
    this.locked = false;

    this.glide = null; // active glide tween

    this._apply();
    this._bind();
  }

  _bind() {
    const down = (e) => this._key(e.code, true);
    const up = (e) => this._key(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.addLook(-e.movementX * LOOK_SENS, -e.movementY * LOOK_SENS);
      this.cancelGlide();
    });
  }

  _key(code, v) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.f = v; break;
      case "KeyS":
      case "ArrowDown":
        this.keys.b = v; break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.l = v; break;
      case "KeyD":
      case "ArrowRight":
        this.keys.r = v; break;
      default:
        return;
    }
    if (v) this.cancelGlide();
  }

  requestLock() {
    if (this.dom.requestPointerLock) this.dom.requestPointerLock();
  }

  addLook(dYaw, dPitch) {
    this.yaw += dYaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + dPitch));
  }

  setAnalog(x, y) {
    this.analog.x = x;
    this.analog.y = y;
    if (x !== 0 || y !== 0) this.cancelGlide();
  }

  // Glide the camera to a viewpoint { x, z, yaw } then face the art.
  glideTo(target) {
    const nz = ((target.yaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // shortest turn
    this.glide = {
      t: 0,
      dur: 0.95,
      fromX: this.pos.x,
      fromZ: this.pos.z,
      toX: target.x,
      toZ: target.z,
      fromYaw: this.yaw,
      dYaw: nz,
      fromPitch: this.pitch,
    };
  }

  cancelGlide() {
    this.glide = null;
  }

  update(dt) {
    if (this.glide) {
      const g = this.glide;
      g.t = Math.min(1, g.t + dt / g.dur);
      const k = easeInOut(g.t);
      this.pos.x = g.fromX + (g.toX - g.fromX) * k;
      this.pos.z = g.fromZ + (g.toZ - g.fromZ) * k;
      this.yaw = g.fromYaw + g.dYaw * k;
      this.pitch = g.fromPitch * (1 - k);
      if (g.t >= 1) this.glide = null;
      this._apply();
      return;
    }

    // desired horizontal movement
    let mf = (this.keys.f ? 1 : 0) - (this.keys.b ? 1 : 0);
    let ms = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0);
    mf += this.analog.y;
    ms += this.analog.x;
    const len = Math.hypot(mf, ms);
    if (len > 1) {
      mf /= len;
      ms /= len;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward = (−sin, 0, −cos), right = (−cos? ) -> right = (cos, 0, −sin) rotated: use (−cos? )
    const fwdX = -sin, fwdZ = -cos;
    const rightX = cos, rightZ = -sin; // = cross(forward, up)
    const targetVX = (fwdX * mf + rightX * ms) * SPEED;
    const targetVZ = (fwdZ * mf + rightZ * ms) * SPEED;

    // smooth accel/decel
    const a = Math.min(1, ACCEL * dt);
    this.vel.x += (targetVX - this.vel.x) * a;
    this.vel.z += (targetVZ - this.vel.z) * a;

    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const safe = resolve(nx, nz, this.layout.bounds, this.layout.colliders, this.radius);
    // kill velocity component if we hit something, to avoid sticking
    if (Math.abs(safe.x - nx) > 1e-4) this.vel.x = 0;
    if (Math.abs(safe.z - nz) > 1e-4) this.vel.z = 0;
    this.pos.x = safe.x;
    this.pos.z = safe.z;
    this.pos.y = this.eye;

    this._apply();
  }

  _apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}

// right vector note: for yaw with forward=(−sin,−cos),
// right = normalize(cross(forward, up)) = (cos, 0, −sin)  -> used above.
