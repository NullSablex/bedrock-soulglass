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
 * Unlike `isInteractive`, this cannot be asked as a property, and the
 * difference is worth stating rather than papering over. A block that opens
 * carries a state saying so; a block that falls carries nothing. There is no
 * component, no state and no reliable tag for gravity — the tags that exist
 * describe which tool digs a block, so `sand` also covers soul sand, which
 * does not fall, and `stone` covers sandstone, which is not sand at all.
 * Matching on those would be worse than matching on names, because it would
 * look principled while being wrong.
 *
 * So this is a list, and `gravityTags` is here for the day the API grows
 * something better, or for a pack that defines its own tag. Empty by default:
 * a wrong tag replaces terrain nobody asked to change.
 *
 * Being incomplete costs less than it looks. A block missing from the list
 * means a lantern that pops loose and is put back by the repair sweep — a
 * visible stutter, not lost belongings, because the vault never depended on
 * the marker standing.
 */
export function fallsWhenUnsupported(block) {
  if (!block) return false;
  const cfg = CONFIG.protection;

  if (cfg.gravityTags.length > 0) {
    try {
      if (cfg.gravityTags.some((tag) => block.hasTag(tag))) return true;
    } catch { /* tags unavailable in this version */ }
  }

  const id = block.typeId;
  if (cfg.gravityBlocks.includes(id)) return true;
  return cfg.gravitySuffixes.some((suffix) => id.endsWith(suffix));
}

/**
 * Does this block do something of its own when right-clicked?
 *
 * If it does, the click belongs to it and not to whatever is in hand. Opening
 * a chest does not use the item you are holding — the game already routes the
 * click correctly, and all this has to do is stop treating the report of that
 * click as a use of the item.
 *
 * Asked as a property, never as a name. An earlier version listed block ids
 * and suffix families, which meant enumerating every wood type and every dyed
 * variant, and being wrong about a colour that shipped later. What a block is
 * called says nothing about what it does.
 *
 * Two properties answer it:
 *
 *   - an inventory component, which every container has: chests, barrels,
 *     furnaces, hoppers, and whatever another add-on adds without telling us;
 *
 *   - a state that only exists because the block can be operated. `open_bit`
 *     belongs to doors, trapdoors, fence gates and levers; `button_pressed_bit`
 *     to buttons; `occupied_bit` to beds. A block with a state describing its
 *     own opening is a block that opens.
 */
export function isInteractive(block) {
  if (!block) return false;

  try {
    if (block.getComponent("minecraft:inventory")) return true;
  } catch { /* no such component in this version */ }

  try {
    const states = block.permutation.getAllStates();
    for (const state of CONFIG.note.interactiveStates) {
      if (state in states) return true;
    }
  } catch { /* permutation unavailable */ }

  // Workstations are operable and say so nowhere in their state: a crafting
  // table looks exactly like a solid cube to every test above.
  return CONFIG.note.interactiveBlocks.includes(block.typeId);
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
