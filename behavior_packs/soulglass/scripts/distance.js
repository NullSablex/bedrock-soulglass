/**
 * Distance to a grave, on the horizontal plane.
 *
 * Infinity for another dimension, so sorting naturally pushes those to the end
 * and callers can test for it instead of carrying a separate flag.
 */
export function distanceTo(player, grave) {
  if (grave.dimension !== player.dimension.id) return Infinity;
  const dx = grave.x - player.location.x;
  const dz = grave.z - player.location.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function byDistance(player, graves) {
  return [...graves].sort((a, b) => distanceTo(player, a) - distanceTo(player, b));
}

export function nearestGrave(player, graves) {
  let best;
  let bestDistance = Infinity;
  for (const grave of graves) {
    const distance = distanceTo(player, grave);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = grave;
    }
  }
  return best ? { grave: best, distance: bestDistance } : undefined;
}
