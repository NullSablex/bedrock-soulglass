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

/** Can a grave occupy this block? */
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

export function above(location) {
  return { x: location.x, y: location.y + 1, z: location.z };
}

export function below(location) {
  return { x: location.x, y: location.y - 1, z: location.z };
}

export function centreOf(location) {
  return { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
}
