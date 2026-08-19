import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { subscribeSafe } from "./safe.js";
import { showHint, forgetHints } from "./hud.js";
import { addGrave, graveAt, gravesOf, removeGrave, posKey } from "./storage.js";
import { xpToBury, clearDroppedOrbs, grantXp } from "./xp.js";
import { equipmentToBury, restoreEquipment } from "./equip.js";
import { giveNote, removeNote, isNote } from "./note.js";
import { listGraves } from "./guide.js";
import { blockAt } from "./blocks.js";
import { findGraveSpot, placeSupport, placeMarker, placeLight, clearLight } from "./placement.js";
import { spawnVault, findVault, containerOf } from "./vault.js";
import { t, tn } from "./msg.js";

/**
 * A grave is a marker block with an invisible vault entity at the same spot.
 * The marker is all the player sees; the vault holds everything.
 */

/**
 * `keepInventory` in Bedrock preserves items AND experience.
 *
 * Without checking the rule the addon would see an empty drop list but still
 * hold the sampled XP, create a grave for experience the player never lost,
 * and duplicate it on recovery. Nothing is lost, so there is no death to cover.
 */
function keepInventoryOn(dimension) {
  try {
    if (typeof world.gameRules?.keepInventory === "boolean") {
      return world.gameRules.keepInventory;
    }
  } catch { /* gameRules unavailable in this version */ }

  try {
    const result = dimension.runCommand("gamerule keepinventory");
    return /true/i.test(result?.statusMessage ?? "");
  } catch {
    return false;
  }
}

/**
 * Collects the item entities scattered by death.
 *
 * Reading the corpse's inventory does not work: by the time `entityDie` fires
 * it has been emptied and the contents are already entities on the ground.
 */
function collectDrops(dimension, origin) {
  let entities = [];
  try {
    entities = dimension.getEntities({
      type: "minecraft:item",
      location: origin,
      maxDistance: CONFIG.pickupRadius,
    });
  } catch {
    return [];
  }

  const stacks = [];
  for (const entity of entities) {
    try {
      const stack = entity.getComponent("minecraft:item")?.itemStack;
      if (!stack) continue;

      // The map is never buried. Locking the only copy inside the very place
      // it points at helps nobody, and a fresh one is issued on respawn.
      if (isNote(stack)) { entity.remove(); continue; }

      stacks.push(stack);
      entity.remove();
    } catch { /* entity already removed */ }
  }
  return stacks;
}

function scatter(dimension, stacks, location) {
  for (const stack of stacks) {
    try { dimension.spawnItem(stack, location); } catch { /* chunk unloaded */ }
  }
}

function fillVault(container, stacks) {
  const overflow = [];
  let slot = 0;
  for (const stack of stacks) {
    if (slot >= container.size) { overflow.push(stack); continue; }
    try {
      container.setItem(slot, stack);
      slot++;
    } catch {
      overflow.push(stack);
    }
  }
  return overflow;
}

function announceBurial(player, xp, overflow) {
  player.sendMessage(xp > 0 ? t("soulglass.marked.xp", xp) : t("soulglass.marked"));
  player.sendMessage(t("soulglass.use_map"));

  if (overflow.length === 0) return;
  // Items, not stacks: five stacks may be five items or three hundred.
  const spilled = overflow.reduce((sum, stack) => sum + stack.amount, 0);
  player.sendMessage(tn(spilled, "soulglass.overflow.one", "soulglass.overflow.many"));
}

function buryPlayer(player, deathLocation, dimension, xp, gear) {
  if (keepInventoryOn(dimension)) return;

  const stacks = collectDrops(dimension, deathLocation);
  if (stacks.length === 0 && xp <= 0) return;

  // The orbs on the ground go away: the experience now lives in the grave.
  if (xp > 0) clearDroppedOrbs(dimension, deathLocation);

  const spot = findGraveSpot(dimension, deathLocation);
  if (!spot) {
    scatter(dimension, stacks, deathLocation);
    return;
  }

  const vault = spawnVault(dimension, spot.location);
  const container = containerOf(vault);
  if (!container) {
    try { vault?.remove(); } catch { /* nothing to undo */ }
    scatter(dimension, stacks, deathLocation);
    return;
  }

  const overflow = fillVault(container, stacks);

  // Support first: the marker needs ground before it can exist.
  if (spot.needsSupport) placeSupport(dimension, spot.location);
  placeMarker(dimension, spot.location);
  placeLight(dimension, spot.location);

  addGrave({
    key: posKey(dimension.id, spot.location),
    ownerId: player.id,
    ownerName: player.name,
    dimension: dimension.id,
    x: spot.location.x, y: spot.location.y, z: spot.location.z,
    xp,
    gear,
    time: Date.now(),
  });

  scatter(dimension, overflow, deathLocation);
  announceBurial(player, xp, overflow);
}

/** @returns { delivered, dropped } counted in items, not stacks. */
function handOverItems(player, container, dimension, location) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  let delivered = 0;
  let dropped = 0;

  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (!stack) continue;
    const amount = stack.amount;
    try {
      // addItem returns what did NOT fit; that remainder hits the ground.
      const leftover = inventory ? inventory.addItem(stack) : stack;
      if (leftover) {
        dimension.spawnItem(leftover, location);
        dropped += leftover.amount;
        delivered += amount - leftover.amount;
      } else {
        delivered += amount;
      }
    } catch {
      try {
        dimension.spawnItem(stack, location);
        dropped += amount;
      } catch { /* chunk unloaded */ }
    }
    container.setItem(i, undefined);
  }
  return { delivered, dropped };
}

/**
 * One key per sentence, rather than assembling a composite one. Gluing
 * translated fragments breaks in any language whose word order differs from
 * English — the whole sentence has to be translatable.
 */
function reportRecovery(player, delivered, equipped, dropped) {
  if (delivered > 0) {
    player.sendMessage(tn(delivered, "soulglass.recovered.one", "soulglass.recovered.many"));
  } else if (equipped === 0) {
    player.sendMessage(t("soulglass.recovered.none"));
  }
  if (equipped > 0) {
    player.sendMessage(tn(equipped, "soulglass.equipped.one", "soulglass.equipped.many"));
  }
  if (dropped > 0) {
    player.sendMessage(tn(dropped, "soulglass.dropped.one", "soulglass.dropped.many"));
  }
}

function dismantle(dimension, vault, location) {
  try { vault?.remove(); } catch { /* already gone */ }
  clearLight(dimension, location);
  try { blockAt(dimension, location)?.setType("minecraft:air"); } catch { /* chunk unloaded */ }
}

function openGrave(player, grave) {
  const dimension = world.getDimension(grave.dimension);
  const location = { x: grave.x, y: grave.y, z: grave.z };

  const vault = findVault(dimension, location);
  const container = containerOf(vault);

  // Armor and offhand first: restoreEquipment consumes those pieces from the
  // vault, so the handover below does not also send them to the backpack.
  const equipped = restoreEquipment(player, container, grave.gear);

  let delivered = 0;
  let dropped = 0;
  if (container) {
    ({ delivered, dropped } = handOverItems(player, container, dimension, location));
  } else {
    // A /kill @e took the vault. The XP still comes back.
    console.warn(`[Soulglass] vault not found at ${grave.key}`);
    player.sendMessage(t("soulglass.lost"));
  }

  dismantle(dimension, vault, location);
  removeGrave(grave.key);
  grantXp(player, grave.xp ?? 0, dimension, location);
  // The map only disappears after the record is gone: it checks for graves.
  removeNote(player);

  if (container) reportRecovery(player, delivered, equipped, dropped);
}

/**
 * A grave cannot be destroyed by anything but its owner breaking it.
 *
 * Breaking by a player is handled in registerGrave. What lives here are the
 * vectors that do NOT go through `playerBreakBlock` and would slip by unseen.
 */
function registerIndestructible() {
  if (CONFIG.protection.explosions) {
    // Cancelling the whole explosion would punish the entire world. Instead the
    // grave's blocks drop out of the affected list: the TNT still goes off.
    subscribeSafe(world.beforeEvents, "explosion", (ev) => {
      try {
        const blocks = ev.getImpactedBlocks();
        const spared = blocks.filter((block) => {
          const { x, y, z } = block.location;
          // The light block sits one above the marker and goes with it.
          return !graveAt(ev.dimension.id, block.location)
            && !graveAt(ev.dimension.id, { x, y: y - 1, z });
        });
        if (spared.length !== blocks.length) ev.setImpactedBlocks(spared);
      } catch (e) {
        console.warn(`[Soulglass] could not filter the explosion: ${e}`);
      }
    });
  }

  if (CONFIG.protection.pistons) {
    // Shoving the marker away would separate it from the vault, which is
    // pinned to its position, leaving the loot unreachable.
    subscribeSafe(world.beforeEvents, "pistonActivate", (ev) => {
      try {
        const attached = ev.piston?.getAttachedBlocks?.() ?? [];
        if (attached.some((location) => graveAt(ev.dimension.id, location))) {
          ev.cancel = true;
        }
      } catch { /* piston API unavailable in this version */ }
    });
  }
}

export function registerGrave() {
  subscribeSafe(world.afterEvents, "entityDie", (ev) => {
    const player = ev.deadEntity;
    if (player?.typeId !== "minecraft:player") return;

    // Read now: after respawn player.location points somewhere else, and the
    // XP and equipment samples belong to the moment before death.
    const dimension = player.dimension;
    const at = { x: player.location.x, y: player.location.y, z: player.location.z };
    const xp = xpToBury(player);
    const gear = equipmentToBury(player);

    // Drops take a few ticks to exist as entities.
    system.runTimeout(
      () => buryPlayer(player, at, dimension, xp, gear),
      CONFIG.pickupDelayTicks
    );
  });

  /*
   * Hints go to the action bar, not the chat. This event fires on every click
   * and keeps firing while the button is held; in the chat that became a flood
   * of identical lines.
   */
  subscribeSafe(world.beforeEvents, "playerInteractWithBlock", (ev) => {
    const grave = graveAt(ev.block.dimension.id, ev.block.location);
    if (!grave) return;
    ev.cancel = true;

    const player = ev.player;
    const message = grave.ownerId === player.id
      ? t("soulglass.hint.break")
      : t("soulglass.hint.owner", grave.ownerName);
    system.run(() => showHint(player, message));
  });

  subscribeSafe(world.beforeEvents, "playerBreakBlock", (ev) => {
    const grave = graveAt(ev.block.dimension.id, ev.block.location);
    if (!grave) return;

    // Always cancelled: the script performs the handover, so the marker never
    // becomes an item on the ground.
    ev.cancel = true;
    const player = ev.player;

    if (CONFIG.ownerOnly && grave.ownerId !== player.id) {
      system.run(() => showHint(player, t("soulglass.hint.owner", grave.ownerName)));
      return;
    }
    system.run(() => openGrave(player, grave));
  });

  // Handed over on respawn: at death the inventory has just been emptied.
  subscribeSafe(world.afterEvents, "playerSpawn", (ev) => {
    if (ev.initialSpawn) return;
    if (gravesOf(ev.player.id).length === 0) return;
    system.runTimeout(() => giveNote(ev.player), 20);
  });

  subscribeSafe(world.afterEvents, "playerLeave", (ev) => forgetHints(ev.playerId));

  registerIndestructible();
}

/** /scriptevent soulglass:find */
export function registerLocator() {
  subscribeSafe(
    system.afterEvents,
    "scriptEventReceive",
    (ev) => {
      if (ev.id !== "soulglass:find") return;
      const player = ev.sourceEntity;
      if (player?.typeId === "minecraft:player") listGraves(player);
    },
    { namespaces: ["soulglass"] }
  );
}
