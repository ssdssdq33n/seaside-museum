// ---------------------------------------------------------------------------
//  Touch controls: left virtual joystick to walk, drag anywhere else to look,
//  quick tap to focus an artwork. Fed into the shared Player.
// ---------------------------------------------------------------------------

const LOOK_SENS = 0.004;

export function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function setupTouch(player, canvas, onTap) {
  const touchUI = document.getElementById("touch");
  const joy = document.getElementById("joystick");
  const stick = document.getElementById("stick");
  touchUI.classList.remove("hidden");

  const R = 46; // joystick travel radius in px
  let joyId = null;
  let joyCx = 0;
  let joyCy = 0;

  const lookPointers = new Map(); // pointerId -> {x, y, moved, t}

  // --- joystick ---
  joy.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    const rect = joy.getBoundingClientRect();
    joyCx = rect.left + rect.width / 2;
    joyCy = rect.top + rect.height / 2;
    joy.setPointerCapture(e.pointerId);
  });
  joy.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - joyCx;
    let dy = e.clientY - joyCy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    player.setAnalog(dx / R, -dy / R); // up = forward
  });
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    stick.style.transform = "translate(0,0)";
    player.setAnalog(0, 0);
  };
  joy.addEventListener("pointerup", joyEnd);
  joy.addEventListener("pointercancel", joyEnd);

  // --- look / tap on the scene ---
  canvas.addEventListener("pointerdown", (e) => {
    lookPointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      moved: 0,
      t: performance.now(),
    });
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = lookPointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.moved += Math.abs(dx) + Math.abs(dy);
    p.x = e.clientX;
    p.y = e.clientY;
    player.addLook(-dx * LOOK_SENS, -dy * LOOK_SENS);
  });
  const endLook = (e) => {
    const p = lookPointers.get(e.pointerId);
    if (!p) return;
    const quick = performance.now() - p.t < 280;
    if (quick && p.moved < 12 && onTap) onTap(p.sx, p.sy);
    lookPointers.delete(e.pointerId);
  };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);
}
