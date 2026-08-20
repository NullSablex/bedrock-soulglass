import { EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "./config.js";

/**
 * Putting each piece back in the slot it came from.
 *
 * Two problems, and the fix for each:
 *
 * 1. The item entities that drop on death carry no record of where they came
 *    from — they are one undifferentiated pile. The fix is a photo of the
 *    equipment taken before death (see tracker.js).
 *
 * 2. If the player had TWO diamond helmets, one worn and one in the backpack,
 *    the item type alone cannot say which to put back on. The fix is a
 *    fingerprint: type, count, name, durability, enchantments and lore. Two
 *    pieces only collide when they are identical in every respect, and then it
 *    makes no difference which one goes back on.
 *
 * The fingerprint is NOT computed while sampling: the ItemStack itself is
 * stored, since it is already a copy, and the expensive part runs once, on
 * death.
 */

const SLOTS = [
  ["head", EquipmentSlot.Head],
  ["chest", EquipmentSlot.Chest],
  ["legs", EquipmentSlot.Legs],
  ["feet", EquipmentSlot.Feet],
  ["offhand", EquipmentSlot.Offhand],
];

/** Last known equipment photo per player. */
const samples = new Map();

function equippable(entity) {
  try {
    return entity.getComponent("minecraft:equippable");
  } catch {
    return undefined;
  }
}

/**
 * The item's identity. It has to include everything that tells two pieces of
 * the same type apart, or the wrong one goes back on the body.
 */
function fingerprint(stack) {
  if (!stack) return undefined;
  const parts = [stack.typeId, String(stack.amount), stack.nameTag ?? ""];

  try {
    const durability = stack.getComponent("minecraft:durability");
    if (durability) parts.push("d" + durability.damage);
  } catch { /* item has no durability */ }

  try {
    const enchantable = stack.getComponent("minecraft:enchantable");
    const list = (enchantable?.getEnchantments() ?? [])
      .map((e) => e.type.id + ":" + e.level)
      .sort();
    parts.push(list.join(","));
  } catch { /* item cannot be enchanted */ }

  try {
    parts.push((stack.getLore() ?? []).join("|"));
  } catch { /* no lore */ }

  return parts.join("§");
}

/** Photographs the equipment slots. Cheap: reads only, no computation. */
export function sampleEquipment(player) {
  if (!CONFIG.equipment.enabled) return;

  const gear = equippable(player);
  if (!gear) return;

  const snapshot = {};
  let empty = true;
  for (const [name, slot] of SLOTS) {
    try {
      const stack = gear.getEquipment(slot);
      if (stack) { snapshot[name] = stack; empty = false; }
    } catch { /* slot unavailable */ }
  }

  /*
   * Important guard: if the reading came back completely empty but a photo
   * with pieces already exists, it almost certainly happened AFTER death — the
   * killing blow fires entityHurt and the player may already be stripped.
   * Overwriting here would erase exactly the photo that matters.
   */
  if (empty && samples.has(player.id)) return;

  samples.set(player.id, snapshot);
}

export function forgetEquipment(playerId) {
  samples.delete(playerId);
}

/**
 * What was worn at death, already as fingerprints — plain strings, which
 * survive a dynamic property without loss.
 */
export function equipmentToBury(player) {
  if (!CONFIG.equipment.enabled) return undefined;

  const snapshot = samples.get(player.id);
  samples.delete(player.id);
  if (!snapshot) return undefined;

  const gear = {};
  for (const [name] of SLOTS) {
    const print = fingerprint(snapshot[name]);
    if (print) gear[name] = print;
  }
  return Object.keys(gear).length > 0 ? gear : undefined;
}

/**
 * Puts the vault's pieces back in their original slots.
 *
 * Consumes them from the container, so the general handover below does not
 * also drop them into the backpack. Returns how many pieces were worn.
 */
export function restoreEquipment(player, container, gear) {
  if (!CONFIG.equipment.enabled || !gear || !container) return 0;

  const equipment = equippable(player);
  if (!equipment) return 0;

  const inventory = player.getComponent("minecraft:inventory")?.container;
  let restored = 0;

  for (const [name, slot] of SLOTS) {
    const wanted = gear[name];
    if (!wanted) continue;

    // Look for the exact piece in the vault, not merely one of the same type.
    let foundIndex = -1;
    for (let i = 0; i < container.size; i++) {
      const stack = container.getItem(i);
      if (!stack) continue;
      if (fingerprint(stack) === wanted) { foundIndex = i; break; }
    }
    if (foundIndex < 0) continue; // destroyed on death, or already collected

    const stack = container.getItem(foundIndex);

    // The player may have re-equipped after respawning: whatever they are
    // wearing now goes to the backpack instead of being overwritten and lost.
    try {
      const current = equipment.getEquipment(slot);
      if (current) {
        const leftover = inventory ? inventory.addItem(current) : current;
        if (leftover) player.dimension.spawnItem(leftover, player.location);
      }
    } catch { /* slot empty */ }

    try {
      equipment.setEquipment(slot, stack);
      container.setItem(foundIndex, undefined);
      restored++;
    } catch (e) {
      console.warn(`[Soulglass] could not re-equip ${name}: ${e}`);
    }
  }

  return restored;
}
