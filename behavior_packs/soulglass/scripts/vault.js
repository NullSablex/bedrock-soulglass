import { CONFIG } from "./config.js";
import { centreOf } from "./blocks.js";

/**
 * The vault: an invisible entity holding the loot, bound to the lantern block.
 *
 * It exists because ItemStack is not losslessly serializable — written books,
 * potions, shulker contents, banner patterns and maps are not exposed for
 * reading and writing. A real inventory never converts anything.
 *
 * An entity rather than a hidden container block buys two things: 41 slots,
 * exactly what a player carries, so one lantern is always enough; and
 * `private: true`, which keeps it from opening on interaction, making the
 * broken block the only way in.
 */

export function spawnVault(dimension, markerLocation) {
  try {
    return dimension.spawnEntity(CONFIG.vault.entityId, centreOf(markerLocation));
  } catch (e) {
    console.warn(`[Soulglass] could not create the vault: ${e}`);
    return undefined;
  }
}

/** Searches by position rather than by a stored id, which would go stale. */
export function findVault(dimension, markerLocation) {
  try {
    const [found] = dimension.getEntities({
      type: CONFIG.vault.entityId,
      location: centreOf(markerLocation),
      maxDistance: 2,
    });
    return found;
  } catch {
    return undefined;
  }
}

export function containerOf(entity) {
  try {
    return entity?.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

/**
 * Everything the vault is holding, read out while the entity still exists.
 *
 * `getItem` hands back a copy rather than a live reference, which is what makes
 * this worth doing: the stacks stay valid after the entity they came from is
 * gone.
 */
export function snapshotVault(entity) {
  const container = containerOf(entity);
  if (!container) return [];

  const stacks = [];
  for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack) stacks.push(stack);
  }
  return stacks;
}
