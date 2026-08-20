import { ItemStack } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { lanternsOf } from "./storage.js";
import { byDistance } from "./distance.js";

/**
 * The soul guide: a sheet of paper carrying the coordinates.
 *
 * Why paper and not a compass. A plain compass points its needle at world
 * spawn, and a recovery compass only works in the dimension where the death
 * happened. Either way the needle is the most visible part of the item and
 * says something other than what the addon means — the player trusts it and
 * walks the wrong way. Paper has no needle, so nothing competes with the
 * action bar and the particle trail.
 *
 * The data never lives on the item; it always comes from the registry. That
 * keeps the sheet fresh, and means a sheet that changes hands shows its new
 * holder's lanterns instead of leaking the previous owner's.
 */

let resolvedItemId;
function noteItemId() {
  if (resolvedItemId) return resolvedItemId;
  for (const id of CONFIG.note.itemIds) {
    try {
      new ItemStack(id, 1);
      resolvedItemId = id;
      return id;
    } catch { /* missing in this version, try the next */ }
  }
  resolvedItemId = CONFIG.note.itemIds[CONFIG.note.itemIds.length - 1];
  return resolvedItemId;
}

export function isNote(stack) {
  if (!stack || !CONFIG.note.itemIds.includes(stack.typeId)) return false;
  return stack.nameTag === CONFIG.note.itemName;
}

/**
 * Item lore takes plain strings, never RawMessage, so this text cannot follow
 * each player's language. It uses the one set in config.js; the coordinates
 * themselves are numbers and read the same everywhere.
 */
function loreFor(player) {
  const mine = lanternsOf(player.id);
  if (mine.length === 0) return [CONFIG.note.loreBlank];

  const lines = [CONFIG.note.loreHeader, "§8-------------------"];
  for (const lantern of byDistance(player, mine)) {
    const dimension = lantern.dimension.replace("minecraft:", "");
    lines.push(`§f${lantern.x}  ${lantern.y}  ${lantern.z}  §8${dimension}`);
  }
  lines.push("§8-------------------", CONFIG.note.loreFooter);
  return lines;
}

function noteSlots(player) {
  const indices = [];
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return { inventory: undefined, indices };
    for (let i = 0; i < inventory.size; i++) {
      if (isNote(inventory.getItem(i))) indices.push(i);
    }
    return { inventory, indices };
  } catch {
    return { inventory: undefined, indices };
  }
}

/**
 * One sheet per player. Extras — picked up off the ground, say — are identical
 * copies, since the contents come from the holder's registry, not the item.
 */
function dedupe(inventory, indices) {
  for (const index of indices.slice(1)) {
    try { inventory.setItem(index, undefined); } catch { /* ignore */ }
  }
}

/**
 * Rewrites the coordinates for whoever holds the sheet.
 *
 * This also closes a leak: lore is baked into the item, so a sheet that
 * changed hands would keep showing the coordinates of whoever created it.
 */
export function refreshNote(player) {
  if (!CONFIG.note.enabled) return;

  const { inventory, indices } = noteSlots(player);
  if (!inventory || indices.length === 0) return;
  if (indices.length > 1) dedupe(inventory, indices);

  try {
    const stack = inventory.getItem(indices[0]);
    const wanted = loreFor(player);
    // Rewriting costs; only touch the item when the content actually changed.
    if ((stack.getLore() ?? []).join("\n") === wanted.join("\n")) return;

    stack.setLore(wanted);
    inventory.setItem(indices[0], stack);
  } catch { /* inventory changed underneath us */ }
}

/**
 * Handed over on respawn — at death the inventory has just been emptied.
 * One sheet per player, not one per death: it lists every lantern.
 */
export function giveNote(player) {
  if (!CONFIG.note.enabled) return;

  if (noteSlots(player).indices.length > 0) {
    refreshNote(player);
    return;
  }

  try {
    const stack = new ItemStack(noteItemId(), 1);
    stack.nameTag = CONFIG.note.itemName;
    stack.setLore(loreFor(player));

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;
    const leftover = inventory.addItem(stack);
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  } catch (e) {
    console.warn(`[Soulglass] failed to hand over the guide: ${e}`);
  }
}

/**
 * Lanterns remain: the sheet stays, refreshed. None remain: every copy goes, so
 * no dead sheet is left pointing nowhere.
 */
export function removeNote(player) {
  if (!CONFIG.note.enabled || !CONFIG.note.consumeOnRecover) return;
  if (lanternsOf(player.id).length > 0) {
    refreshNote(player);
    return;
  }

  const { inventory, indices } = noteSlots(player);
  if (!inventory) return;
  for (const index of indices) {
    try { inventory.setItem(index, undefined); } catch { /* ignore */ }
  }
}

export function holdingNote(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    return isNote(inventory?.getItem(player.selectedSlotIndex));
  } catch {
    return false;
  }
}
