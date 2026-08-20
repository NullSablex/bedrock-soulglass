/**
 * Distance to a lantern, on the horizontal plane.
 *
 * Infinity for another dimension, so sorting naturally pushes those to the end
 * and callers can test for it instead of carrying a separate flag.
 */
export function distanceTo(player, lantern) {
  if (lantern.dimension !== player.dimension.id) return Infinity;
  const dx = lantern.x - player.location.x;
  const dz = lantern.z - player.location.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function byDistance(player, lanterns) {
  return [...lanterns].sort((a, b) => distanceTo(player, a) - distanceTo(player, b));
}

export function nearestLantern(player, lanterns) {
  let best;
  let bestDistance = Infinity;
  for (const lantern of lanterns) {
    const distance = distanceTo(player, lantern);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = lantern;
    }
  }
  return best ? { lantern: best, distance: bestDistance } : undefined;
}
