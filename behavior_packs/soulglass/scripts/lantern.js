import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { subscribeSafe } from "./safe.js";
import { showHint, forgetHints } from "./hud.js";
import {
  addLantern, lanternAt, lanternsOf, allLanterns, removeLantern, posKey,
} from "./storage.js";
import { xpToBury, clearDroppedOrbs, grantXp } from "./xp.js";
import { equipmentToBury, restoreEquipment } from "./equip.js";
import { giveNote, removeNote, isNote } from "./note.js";
import { listLanterns } from "./chat.js";
import { blockAt, below, above, isFree } from "./blocks.js";
import {
  findLanternSpot, placeSupport, stabiliseBase, placeMarker, placeLight, clearLight,
  isMarker,
} from "./placement.js";
import { spawnVault, findVault, containerOf, snapshotVault } from "./vault.js";
import { t, tn } from "./msg.js";

/**
 * A lantern is a marker block with an invisible vault entity at the same spot.
 * The marker is all the player sees; the vault holds everything.
 */

/**
 * `keepInventory` in Bedrock preserves items AND experience.
 *
 * Without checking the rule the addon would see an empty drop list but still
 * hold the sampled XP, create a lantern for experience the player never lost,
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
 * Reading the dead player's inventory does not work: by the time `entityDie` fires
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

      // The guide never goes into the lantern: locking the only copy inside
      // the thing it points at helps nobody, and a fresh one is issued on
      // respawn.
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

/**
 * Stores what it can and returns what did not fit.
 *
 * It looks for a free slot rather than counting from zero, because the later
 * sweeps call this on a vault that already holds the first pass. Writing from
 * slot zero again would overwrite the loot instead of adding to it.
 */
function fillVault(container, stacks) {
  const overflow = [];
  let slot = 0;

  for (const stack of stacks) {
    while (slot < container.size && container.getItem(slot)) slot++;
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

function announceLantern(player, overflow) {
  /*
   * One line, and no numbers in it.
   *
   * The player just died: they know they lost their experience, and they get
   * all of it back on breaking the lantern. Quoting the amount answers a
   * question nobody asked and leads to no decision. What they cannot know is
   * that a lantern now exists somewhere, so that is all this says.
   */
  if (CONFIG.messages.onLit) player.sendMessage(t("soulglass.marked"));

  if (overflow.length === 0 || !CONFIG.messages.warnDropped) return;
  // Items, not stacks: five stacks may be five items or three hundred.
  const spilled = overflow.reduce((sum, stack) => sum + stack.amount, 0);
  player.sendMessage(tn(spilled, "soulglass.overflow.one", "soulglass.overflow.many"));
}

function lightLantern(player, deathLocation, dimension, xp, gear) {
  if (keepInventoryOn(dimension)) return;

  const stacks = collectDrops(dimension, deathLocation);
  if (stacks.length === 0 && xp <= 0) return;

  // The orbs on the ground go away: the experience now lives in the lantern.
  if (xp > 0) clearDroppedOrbs(dimension, deathLocation);

  const spot = findLanternSpot(dimension, deathLocation);
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

  // Ground first: the marker needs something to stand on before it can exist,
  // and that something must not be able to fall.
  if (spot.needsSupport) placeSupport(dimension, spot.location);
  stabiliseBase(dimension, spot.location);
  placeMarker(dimension, spot.location);
  placeLight(dimension, spot.location);

  addLantern({
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
  announceLantern(player, overflow);
  scheduleSweeps(dimension, deathLocation, spot.location, xp > 0);
}

/**
 * Later passes over the death site, feeding the same lantern.
 *
 * The first collection runs two ticks after death so the loot spends as little
 * time as possible lying on the ground. That speed costs coverage: items are
 * still flying outward and orbs are still spreading. These sweeps pick up what
 * the first pass was too early to see.
 *
 * The orbs matter more than the items. Their value is already stored in the
 * lantern, so an orb left on the ground is experience the player collects twice.
 */
function scheduleSweeps(dimension, deathLocation, lanternLocation, hadXp) {
  for (const delay of CONFIG.sweepTicks) {
    system.runTimeout(() => {
      if (hadXp) clearDroppedOrbs(dimension, deathLocation);

      const late = collectDrops(dimension, deathLocation);
      if (late.length === 0) return;

      const container = containerOf(findVault(dimension, lanternLocation));
      if (!container) {
        // The lantern is gone already — the owner was quick. Put the stragglers
        // back on the ground rather than deleting them.
        scatter(dimension, late, deathLocation);
        return;
      }
      scatter(dimension, fillVault(container, late), deathLocation);
    }, delay);
  }
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
 * Says as little as possible.
 *
 * Recovery narrates itself: the items are in the inventory, the armor is on
 * the body, the experience bar moved. Announcing each of those was four lines
 * describing what the player had just watched happen.
 *
 * Only the part they cannot see survives by default — items left on the ground
 * because the backpack was full, which despawn if ignored. The breakdown is
 * still available behind `messages.onRecovery` for anyone who wants it.
 *
 * One key per sentence, never glued fragments: word order differs between
 * languages, so a whole sentence has to be translatable as a unit.
 */
function reportRecovery(player, delivered, equipped, dropped) {
  if (CONFIG.messages.onRecovery) {
    if (delivered > 0) {
      player.sendMessage(tn(delivered, "soulglass.recovered.one", "soulglass.recovered.many"));
    } else if (equipped === 0) {
      player.sendMessage(t("soulglass.recovered.none"));
    }
    if (equipped > 0) {
      player.sendMessage(tn(equipped, "soulglass.equipped.one", "soulglass.equipped.many"));
    }
  }

  if (dropped > 0 && CONFIG.messages.warnDropped) {
    player.sendMessage(tn(dropped, "soulglass.dropped.one", "soulglass.dropped.many"));
  }
}

function dismantle(dimension, vault, location) {
  try { vault?.remove(); } catch { /* already gone */ }
  clearLight(dimension, location);
  try { blockAt(dimension, location)?.setType("minecraft:air"); } catch { /* chunk unloaded */ }
}

function openLantern(player, lantern) {
  const dimension = world.getDimension(lantern.dimension);
  const location = { x: lantern.x, y: lantern.y, z: lantern.z };

  const vault = findVault(dimension, location);
  const container = containerOf(vault);

  // Armor and offhand first: restoreEquipment consumes those pieces from the
  // vault, so the handover below does not also send them to the backpack.
  const equipped = restoreEquipment(player, container, lantern.gear);

  let delivered = 0;
  let dropped = 0;
  if (container) {
    ({ delivered, dropped } = handOverItems(player, container, dimension, location));
  } else {
    // A /kill @e took the vault. The XP still comes back.
    console.warn(`[Soulglass] vault not found at ${lantern.key}`);
    player.sendMessage(t("soulglass.lost"));
  }

  dismantle(dimension, vault, location);
  removeLantern(lantern.key);
  grantXp(player, lantern.xp ?? 0, dimension, location);
  // The guide only disappears after the record is gone: it checks for lanterns.
  removeNote(player);

  if (container) reportRecovery(player, delivered, equipped, dropped);
}

/**
 * A lantern cannot be destroyed by anything but its owner breaking it.
 *
 * Breaking by a player is handled in registerLantern. What lives here are the
 * vectors that do NOT go through `playerBreakBlock` and would slip by unseen.
 */
/**
 * Puts the vault back after something removed the entity.
 *
 * `/kill @e` is why this exists. The vault refuses every kind of damage, but
 * `/kill` does not deal damage — it removes the entity outright, and no
 * component prevents that. Since the command is normally typed to clear
 * dropped items or mobs, emptying a player's lantern is collateral nobody
 * asked for, and "do not run that command" is not a fix.
 *
 * The contents are read in the before-event, while the entity is still there,
 * and a replacement is filled on the next tick.
 */
function rescueVault(dimension, markerLocation, stacks) {
  // The registry decides whether this position is a lantern at all. Without a
  // record there is nothing to rescue and no owner to rescue it for.
  if (!lanternAt(dimension.id, markerLocation)) return;

  /*
   * An unloading chunk removes its entities too, and that is not a loss —
   * they come back with the chunk. Reading the marker block is what tells the
   * two apart: while the chunk is gone the block is unreadable, and a lantern
   * nobody is near needs no rescue.
   */
  if (!blockAt(dimension, markerLocation)) return;

  // Never two vaults for one lantern. That would duplicate every item in it,
  // which is a worse bug than the one being fixed.
  if (findVault(dimension, markerLocation)) return;

  const container = containerOf(spawnVault(dimension, markerLocation));
  if (!container) {
    console.warn(`[Soulglass] could not rebuild the vault at ${posKey(dimension.id, markerLocation)}`);
    return;
  }

  const overflow = fillVault(container, stacks);
  if (overflow.length > 0) scatter(dimension, overflow, markerLocation);
  console.warn(
    `[Soulglass] vault removed and rebuilt at ` +
    `${markerLocation.x} ${markerLocation.y} ${markerLocation.z} in ${dimension.id}`
  );
}

function registerVaultRescue() {
  if (!CONFIG.protection.rescueVault) return;

  subscribeSafe(world.beforeEvents, "entityRemove", (ev) => {
    const entity = ev.removedEntity;
    if (entity?.typeId !== CONFIG.vault.entityId) return;

    // Read now: one tick later there is nothing left to read.
    const dimension = entity.dimension;
    const at = entity.location;
    const markerLocation = {
      x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z),
    };
    const stacks = snapshotVault(entity);

    system.run(() => rescueVault(dimension, markerLocation, stacks));
  });
}

function registerIndestructible() {
  if (CONFIG.protection.explosions) {
    // Cancelling the whole explosion would punish the entire world. Instead the
    // lantern's blocks drop out of the affected list: the TNT still goes off.
    subscribeSafe(world.beforeEvents, "explosion", (ev) => {
      try {
        const blocks = ev.getImpactedBlocks();
        const spared = blocks.filter((block) => {
          const { x, y, z } = block.location;
          // Three positions belong to a lantern: the marker, the light block
          // one above it, and the ground one below holding it up.
          return !lanternAt(ev.dimension.id, block.location)
            && !lanternAt(ev.dimension.id, { x, y: y - 1, z })
            && !lanternAt(ev.dimension.id, { x, y: y + 1, z });
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
        if (attached.some((location) => lanternAt(ev.dimension.id, location)
          || lanternAt(ev.dimension.id, above(location)))) {
          ev.cancel = true;
        }
      } catch { /* piston API unavailable in this version */ }
    });
  }
}

/**
 * Puts back any marker that has gone missing.
 *
 * Prevention closes the vectors that announce themselves: a player breaking,
 * an explosion, a piston. It cannot close the ones that do not, and those are
 * not exotic — gravel falling onto the lantern, fire, lava reaching it, another
 * addon rewriting the block. The registry is what ties a position to its owner
 * and their belongings, so the registry wins: if it says a lantern stands here,
 * the block goes back.
 *
 * Cheap on purpose. One block read per lantern, and an unloaded chunk returns
 * undefined, which is skipped rather than treated as a missing marker — a
 * lantern in a chunk nobody has visited is not damaged, it is just absent.
 */
function repairMarkers() {
  for (const lantern of allLanterns()) {
    const dimension = dimensionOf(lantern.dimension);
    if (!dimension) continue;

    const location = { x: lantern.x, y: lantern.y, z: lantern.z };
    const block = blockAt(dimension, location);
    if (!block) continue;

    // Lanterns created before the base was stabilised still stand on whatever
    // they landed on. Convert them in place: a lantern on gravel is one dig
    // away from falling, and the dig can be anywhere down the column.
    stabiliseBase(dimension, location);

    if (isMarker(block)) continue;

    // Only reclaim space nothing else is using. Overwriting whatever a player
    // built here would trade one kind of loss for another.
    if (!isFree(block)) continue;

    // Ground first: the marker cannot stand without it.
    if (isFree(blockAt(dimension, below(location)))) {
      placeSupport(dimension, location);
    }

    if (placeMarker(dimension, location)) {
      placeLight(dimension, location);
      console.warn(
        `[Soulglass] restored ${lantern.ownerName}'s marker at ` +
        `${lantern.x} ${lantern.y} ${lantern.z} in ${lantern.dimension}`
      );
    }
  }
}

/**
 * The lantern this block belongs to: the marker itself, or the ground under it.
 *
 * Both positions are the same lantern, because the marker cannot stand without
 * the block beneath it — an attack on either is an attack on the loot.
 *
 * One level is enough because the ground is guaranteed not to fall: a base that
 * could is replaced when the lantern is created, and older lanterns are converted
 * by the repair sweep. Following a column of gravel upward would be the fix if
 * that guarantee did not exist.
 */
function lanternAtOrUnder(block) {
  const dimensionId = block.dimension.id;
  const direct = lanternAt(dimensionId, block.location);
  if (direct) return direct;
  if (!CONFIG.protection.support) return undefined;
  return lanternAt(dimensionId, above(block.location));
}

function dimensionOf(id) {
  try { return world.getDimension(id); } catch { return undefined; }
}

export function registerLantern() {
  registerVaultRescue();

  if (CONFIG.repairTicks > 0) {
    system.runInterval(repairMarkers, CONFIG.repairTicks);
  }

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
      () => lightLantern(player, at, dimension, xp, gear),
      CONFIG.pickupDelayTicks
    );
  });

  /*
   * Hints go to the action bar, not the chat. This event fires on every click
   * and keeps firing while the button is held; in the chat that became a flood
   * of identical lines.
   */
  subscribeSafe(world.beforeEvents, "playerInteractWithBlock", (ev) => {
    const lantern = lanternAt(ev.block.dimension.id, ev.block.location);
    if (!lantern) return;
    ev.cancel = true;

    const player = ev.player;
    const message = lantern.ownerId === player.id
      ? t("soulglass.hint.break")
      : t("soulglass.hint.owner", lantern.ownerName);
    system.run(() => showHint(player, message));
  });

  subscribeSafe(world.beforeEvents, "playerBreakBlock", (ev) => {
    const lantern = lanternAtOrUnder(ev.block);
    if (!lantern) return;

    /*
     * Always cancelled, whichever of the two blocks was hit.
     *
     * The script performs the handover, so the marker never becomes an item on
     * the ground. Cancelling the ground too is what makes the two cases behave
     * alike: a soul lantern needs support, so breaking the block under it pops
     * it off as an ordinary item — and the event fires for the ground, not for
     * the marker, so nothing would notice. The vault would stay pinned below
     * with nothing left to open it, and re-placing a lantern by hand would not
     * help, because the registry keys on a position and the block carries no
     * identity.
     */
    ev.cancel = true;
    const player = ev.player;

    if (CONFIG.ownerOnly && lantern.ownerId !== player.id) {
      system.run(() => showHint(player, t("soulglass.hint.owner", lantern.ownerName)));
      return;
    }

    // Hitting the ground counts as breaking the lantern: same owner, same
    // belongings, and no reason to make them aim at a different block.
    system.run(() => openLantern(player, lantern));
  });

  // Handed over on respawn: at death the inventory has just been emptied.
  subscribeSafe(world.afterEvents, "playerSpawn", (ev) => {
    if (ev.initialSpawn) return;
    if (lanternsOf(ev.player.id).length === 0) return;
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
      if (player?.typeId === "minecraft:player") listLanterns(player);
    },
    { namespaces: ["soulglass"] }
  );
}
