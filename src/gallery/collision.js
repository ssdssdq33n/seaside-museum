// ---------------------------------------------------------------------------
//  Collision — keeps the visitor inside the hall and out of the partitions.
//  Pure maths on the XZ plane; the player is treated as a circle of `radius`.
// ---------------------------------------------------------------------------

export function clampToBounds(x, z, bounds, radius) {
  return {
    x: Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x)),
    z: Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z)),
  };
}

// Push a circle out of an axis-aligned box using the smallest displacement.
export function resolveBox(x, z, box, radius) {
  const minX = box.minX - radius;
  const maxX = box.maxX + radius;
  const minZ = box.minZ - radius;
  const maxZ = box.maxZ + radius;

  if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) {
    return { x, z }; // outside the inflated box — no collision
  }

  // Inside: find the nearest face and eject.
  const dLeft = x - minX;
  const dRight = maxX - x;
  const dBottom = z - minZ;
  const dTop = maxZ - z;
  const m = Math.min(dLeft, dRight, dBottom, dTop);

  if (m === dLeft) return { x: minX, z };
  if (m === dRight) return { x: maxX, z };
  if (m === dBottom) return { x, z: minZ };
  return { x, z: maxZ };
}

export function resolve(x, z, bounds, colliders, radius) {
  let p = clampToBounds(x, z, bounds, radius);
  for (const box of colliders) {
    p = resolveBox(p.x, p.z, box, radius);
  }
  // Re-clamp in case a push nudged us past the outer wall near a corner.
  p = clampToBounds(p.x, p.z, bounds, radius);
  return p;
}

export function zoneAt(x, z, zones) {
  for (const zone of zones) {
    if (x >= zone.xMin && x < zone.xMax && z >= zone.zMin && z < zone.zMax) return zone;
  }
  return zones[zones.length - 1];
}
