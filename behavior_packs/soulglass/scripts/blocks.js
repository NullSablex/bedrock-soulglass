import { CONFIG } from "./config.js";

/** Reading a block throws when the chunk is not loaded. */
export function blockAt(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined;
  }
}

export function isLiquid(block) {
  if (!block) return false;
  if (block.isLiquid) return true;
  const id = block.typeId;
  return id.includes("water") || id.includes("lava");
}

/** Can a lantern occupy this block? */
export function isFree(block) {
  if (!block) return false;
  if (isLiquid(block)) return false;
  return block.isAir || CONFIG.replaceable.includes(block.typeId);
}

/** Can a player stand on top of it? */
export function isFloor(block) {
  if (!block) return false;
  if (block.isAir || isLiquid(block)) return false;
  return !CONFIG.replaceable.includes(block.typeId);
}

/**
 * Does this block drop when whatever holds it up is removed?
 *
 * Exact ids first, then the families the game spells out one id per colour or
 * damage level. Never a substring test: `minecraft:sandstone` contains `sand`
 * and stays exactly where it is, and so does `minecraft:soul_sand`.
 */
export function fallsWhenUnsupported(block) {
  if (!block) return false;
  const id = block.typeId;
  const cfg = CONFIG.protection;
  if (cfg.gravityBlocks.includes(id)) return true;
  return cfg.gravitySuffixes.some((suffix) => id.endsWith(suffix));
}

/**
 * Does this block do something of its own when right-clicked?
 *
 * If it does, the click belongs to it and not to whatever is in hand: opening
 * a chest does not use the item you are holding, and a menu appearing over the
 * chest is the add-on talking over the game.
 *
 * Containers answer for themselves through their inventory component, which
 * covers chests, barrels, furnaces, hoppers and every modded box nobody can
 * enumerate. The rest is the configured list — doors, workstations, beds, the
 * things that react while holding nothing.
 */
export function isInteractive(block) {
  if (!block) return false;

  try {
    if (block.getComponent("minecraft:inventory")) return true;
  } catch { /* no such component in this version */ }

  const id = block.typeId;
  const cfg = CONFIG.note;
  if (cfg.interactiveBlocks.includes(id)) return true;
  return cfg.interactiveSuffixes.some((suffix) => id.endsWith(suffix));
}

export function above(location) {
  return { x: location.x, y: location.y + 1, z: location.z };
}

export function below(location) {
  return { x: location.x, y: location.y - 1, z: location.z };
}

export function centreOf(location) {
  return { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
}
