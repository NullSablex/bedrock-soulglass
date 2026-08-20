import { BlockPermutation } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  blockAt, isLiquid, isFree, isFloor, above, below, fallsWhenUnsupported,
} from "./blocks.js";

/**
 * Choosing where a grave appears.
 *
 * One rule, applied everywhere: the grave goes to the nearest SAFE block,
 * measured in three dimensions from where the player died. This is how a bed
 * finds a respawn spot, and it is the whole design.
 *
 * An earlier version had three passes with different standards, and the last
 * of them accepted a liquid position as a desperate measure — so dying at the
 * bottom of the ocean produced a grave inside the water, which is exactly what
 * the careful checks existed to prevent. Softening the rule in the branch that
 * runs when things go wrong defeats having the rule at all.
 */

const SIDES = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
];

function touchesLiquid(dimension, location) {
  return SIDES.some((offset) => isLiquid(blockAt(dimension, {
    x: location.x + offset.x,
    y: location.y + offset.y,
    z: location.z + offset.z,
  })));
}

/**
 * Safe means all of it: the grave fits, the owner can stand there and swing at
 * it, and no water or lava is touching the spot.
 */
function isSafe(dimension, location) {
  const cfg = CONFIG.placement;
  if (!isFree(blockAt(dimension, location))) return false;
  if (!isFree(blockAt(dimension, above(location)))) return false;
  if (cfg.requireStanding && !isFloor(blockAt(dimension, below(location)))) return false;
  if (cfg.avoidLiquids && touchesLiquid(dimension, location)) return false;
  return true;
}

/**
 * Positions around the origin, nearest first.
 *
 * Walks outward in cubic shells, yielding only the surface of each shell so no
 * position is visited twice. Most deaths resolve at shell 0 or 1, so the cost
 * of a wide radius is paid only by the deaths that need it.
 */
function* shellsAround(origin, radius) {
  const cx = Math.floor(origin.x);
  const cy = Math.floor(origin.y);
  const cz = Math.floor(origin.z);

  for (let r = 0; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
          yield { x: cx + dx, y: cy + dy, z: cz + dz };
        }
      }
    }
  }
}

/**
 * @returns { location, needsSupport } or undefined.
 *
 * needsSupport marks the one case the nearest-safe-block rule cannot solve:
 * a death with no safe block anywhere near, in the void or deep underwater.
 * The grave then rises straight up out of the liquid and stands on a platform
 * built for it — still never inside water or lava.
 */
export function findGraveSpot(dimension, origin) {
  const cfg = CONFIG.placement;
  const floorY = CONFIG.minY[dimension.id] ?? -60;

  for (const location of shellsAround(origin, cfg.searchRadius)) {
    if (location.y < floorY) continue;
    if (isSafe(dimension, location)) return { location, needsSupport: false };
  }

  if (!cfg.buildSupport) return undefined;

  // Nothing safe nearby. Climb the death column until it leaves the liquid.
  // The range is much larger than the search radius because that is the point:
  // an ocean floor can sit a hundred blocks below the surface.
  const startY = Math.max(Math.floor(origin.y), floorY);
  for (let y = startY; y < startY + cfg.emergencySearchUp; y++) {
    const location = { x: Math.floor(origin.x), y, z: Math.floor(origin.z) };
    if (!isFree(blockAt(dimension, location))) continue;
    if (!isFree(blockAt(dimension, above(location)))) continue;
    return { location, needsSupport: true };
  }
  return undefined;
}

export function placeSupport(dimension, location) {
  try {
    blockAt(dimension, below(location))?.setType(CONFIG.placement.supportBlock);
  } catch (e) {
    console.warn(`[Soulglass] could not build the support: ${e}`);
  }
}

/** First marker id in the list that exists in this game version. */
let resolvedMarker;

/**
 * Turns an unstable base into a solid one.
 *
 * The same reasoning that builds ground over the void applies to ground that
 * only looks like ground. A lantern on gravel or sand is held up by the whole
 * column beneath it: break any link and the lot drops, the lantern pops off as
 * an ordinary item, and the break event names the block that was hit rather
 * than the lantern. Rather than guard every link, the one block that matters
 * stops being able to fall.
 *
 * One block of the world changes, which is the cost. It buys a lantern that
 * cannot be dropped by digging somewhere else entirely.
 */
export function stabiliseBase(dimension, location) {
  if (!CONFIG.placement.stabiliseBase) return;

  const base = blockAt(dimension, below(location));
  if (!fallsWhenUnsupported(base)) return;

  try {
    base.setType(CONFIG.placement.supportBlock);
  } catch (e) {
    console.warn(`[Soulglass] could not stabilise the base: ${e}`);
  }
}

export function placeMarker(dimension, location) {
  const block = blockAt(dimension, location);
  if (!block) return false;

  if (resolvedMarker) {
    try { block.setType(resolvedMarker); return true; } catch { return false; }
  }
  for (const id of CONFIG.markerBlocks) {
    try {
      block.setType(id);
      resolvedMarker = id;
      return true;
    } catch { /* missing in this version, try the next */ }
  }
  console.warn("[Soulglass] no marker block from the list exists in this version");
  return false;
}

/**
 * Is this block one of the markers?
 *
 * Used to notice a marker that is gone. The registry says a grave is at a
 * position; the world is what decides whether the block is still there.
 */
export function isMarker(block) {
  if (!block) return false;
  return CONFIG.markerBlocks.includes(block.typeId);
}

/**
 * Optional extra light above the grave. `light_block` is invisible and
 * walkable, so it takes the headroom without getting in the way.
 */
export function placeLight(dimension, markerLocation) {
  const cfg = CONFIG.placement.light;
  if (!cfg?.enabled) return;

  const block = blockAt(dimension, above(markerLocation));
  if (!block || !isFree(block)) return;

  try {
    block.setPermutation(
      BlockPermutation.resolve(cfg.block, { block_light_level: cfg.level })
    );
  } catch {
    // Older versions may not accept the state; the plain type still lights up.
    try { block.setType(cfg.block); } catch { /* block missing entirely */ }
  }
}

export function clearLight(dimension, markerLocation) {
  const cfg = CONFIG.placement.light;
  if (!cfg?.enabled) return;

  const block = blockAt(dimension, above(markerLocation));
  if (block?.typeId === cfg.block) {
    try { block.setType("minecraft:air"); } catch { /* chunk unloaded */ }
  }
}
