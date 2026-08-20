/**
 * Distance to a lantern.
 *
 * Infinity for another dimension, so sorting naturally pushes those to the end
 * and callers can test for it instead of carrying a separate flag.
 */

/**
 * True distance, height included.
 *
 * This used to measure the horizontal plane only, which made a lantern
 * directly above or below read as zero blocks away: standing on the roof over
 * your own lantern announced that you had arrived, and the listing agreed. Any
 * answer this module gives is about whether the player can reach the thing, and
 * fifty blocks of air is exactly as far as fifty blocks of ground.
 */
export function distanceTo(player, lantern) {
  if (lantern.dimension !== player.dimension.id) return Infinity;
  const dx = lantern.x - player.location.x;
  const dy = lantern.y - player.location.y;
  const dz = lantern.z - player.location.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Distance across the ground, for the parts that are about direction.
 *
 * A heading is a compass bearing: height has no place in it, and including it
 * would make "ahead" wobble as the player climbs. Separate from distanceTo on
 * purpose — collapsing the two is what caused the bug described above.
 */
export function groundDistanceTo(player, lantern) {
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
