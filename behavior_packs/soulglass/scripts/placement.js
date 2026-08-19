import { BlockPermutation } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { blockAt, isLiquid, isFree, isFloor, above, below } from "./blocks.js";

/**
 * Choosing where a grave appears.
 *
 * Finding empty space is not enough. Dying in lava or at the bottom of the sea
 * would put the grave inside the liquid, and the owner would have to die again
 * to recover their own belongings. The spot has to be REACHABLE: solid ground
 * to stand on, headroom to swing at it, and no liquid touching it.
 */

const NEIGHBOURS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  { x: 0, y: 1, z: 0 },
];

function noLiquidAround(dimension, location) {
  return NEIGHBOURS.every((offset) => !isLiquid(blockAt(dimension, {
    x: location.x + offset.x,
    y: location.y + offset.y,
    z: location.z + offset.z,
  })));
}

function isReachable(dimension, location) {
  const cfg = CONFIG.placement;
  if (!isFree(blockAt(dimension, location))) return false;
  if (!isFree(blockAt(dimension, above(location)))) return false;
  if (cfg.requireStanding && !isFloor(blockAt(dimension, below(location)))) return false;
  if (cfg.avoidLiquids && !noLiquidAround(dimension, location)) return false;
  return true;
}

/** Columns in growing rings around the death point, nearest first. */
function* columnsAround(origin, radius) {
  const cx = Math.floor(origin.x);
  const cz = Math.floor(origin.z);
  for (let r = 0; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        yield { x: cx + dx, z: cz + dz };
      }
    }
  }
}

/**
 * @returns { location, needsSupport } or undefined.
 *
 * needsSupport marks the desperate case — death in the void or mid-ocean —
 * where no reachable spot exists. An improvised platform beats an unreachable
 * grave.
 */
export function findGraveSpot(dimension, origin) {
  const cfg = CONFIG.placement;
  const startY = Math.max(Math.floor(origin.y), CONFIG.minY[dimension.id] ?? -60);
  const topY = startY + cfg.searchUp;

  for (const column of columnsAround(origin, cfg.searchRadius)) {
    for (let y = startY; y < topY; y++) {
      const location = { x: column.x, y, z: column.z };
      if (isReachable(dimension, location)) return { location, needsSupport: false };
    }
  }

  if (!cfg.buildSupport) return undefined;

  for (let y = startY; y < topY; y++) {
    const location = { x: Math.floor(origin.x), y, z: Math.floor(origin.z) };
    const here = blockAt(dimension, location);
    if (here && (here.isAir || isLiquid(here) || isFree(here))) {
      return { location, needsSupport: true };
    }
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
