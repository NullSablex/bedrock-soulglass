import { system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { t } from "./msg.js";

/**
 * Experience.
 *
 * Two problems the API imposes, and how each is solved:
 *
 * 1. READING the XP at the moment of death does not work — by the time
 *    `entityDie` fires the player has been zeroed. The fix is to use the last
 *    sample taken before death (see tracker.js).
 *
 * 2. RETURNING it as real orbs runs into a limit: `spawnEntity` creates a
 *    `minecraft:xp_orb` but the API never exposes an orb's value. The fix is
 *    to spawn a COUNT of orbs derived from `xpPerOrb`, capped, and credit the
 *    remainder directly — the player collects orbs and loses nothing.
 */

/** Last known XP reading per player. */
const samples = new Map();

function totalXpOf(player) {
  try {
    const total = player.getTotalXp?.();
    if (typeof total === "number") return total;
  } catch { /* method unavailable in this version */ }
  return undefined;
}

function levelOf(player) {
  try {
    return player.level ?? 0;
  } catch {
    return 0;
  }
}

/** Photographs the current XP. Cheap: two reads. */
export function sampleXp(player) {
  if (!CONFIG.xp.enabled) return;
  const total = totalXpOf(player);
  if (total === undefined) return;

  // Same guard as the equipment sampler: a zeroed reading right after the
  // killing blow must not erase the good photo.
  if (total === 0 && (samples.get(player.id)?.total ?? 0) > 0) return;

  samples.set(player.id, { total, level: levelOf(player) });
}

export function forgetXp(playerId) {
  samples.delete(playerId);
}

/** How much to bury with the player who just died. */
export function xpToBury(player) {
  if (!CONFIG.xp.enabled) return 0;

  const sample = samples.get(player.id);
  if (!sample) return 0;
  samples.delete(player.id);

  if (CONFIG.xp.mode === "vanilla") {
    // Vanilla rule: drop 7 per level, capped at 100.
    return Math.min(sample.level * 7, 100);
  }
  return sample.total;
}

/**
 * Removes the orbs that dropped on death. Without this the player would
 * receive the experience twice: once from the ground, once from the grave.
 */
export function clearDroppedOrbs(dimension, origin) {
  try {
    const orbs = dimension.getEntities({
      type: "minecraft:xp_orb",
      location: origin,
      maxDistance: CONFIG.xp.orbRadius,
    });
    for (const orb of orbs) {
      try { orb.remove(); } catch { /* already gone */ }
    }
  } catch { /* dimension or chunk unavailable */ }
}

/** Credits the exact amount at once. Used by "direct" mode and for remainders. */
function grantDirect(player, amount) {
  try {
    player.addExperience(amount);
    player.playSound("random.orb");
  } catch (e) {
    console.warn(`[Soulglass] failed to credit XP: ${e}`);
  }
}

/**
 * Spawns orbs for the player to collect.
 *
 * The count comes from `xpPerOrb` because the API does not expose an orb's
 * value — there is no way to create "one orb worth 500". The `maxOrbs` cap
 * keeps a large haul from turning into hundreds of entities; whatever exceeds
 * the cap is credited directly.
 */
function spawnOrbs(player, dimension, location, amount) {
  const cfg = CONFIG.xp;
  const perOrb = Math.max(1, cfg.xpPerOrb);
  const wanted = Math.ceil(amount / perOrb);
  const orbs = Math.min(wanted, cfg.maxOrbs);
  const remainder = amount - orbs * perOrb;

  // Spread the spawns across ticks: 80 entities in one tick stalls the server.
  const batch = 10;
  for (let i = 0; i < orbs; i += batch) {
    const count = Math.min(batch, orbs - i);
    system.runTimeout(() => {
      for (let n = 0; n < count; n++) {
        try {
          dimension.spawnEntity("minecraft:xp_orb", {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5,
          });
        } catch { /* particle unavailable or chunk unloaded */ }
      }
    }, (i / batch) * cfg.orbBatchDelay);
  }

  if (remainder > 0) grantDirect(player, remainder);
}

/**
 * Returns the experience when the owner breaks the grave.
 * `location` is the block position the orbs come from.
 */
export function grantXp(player, amount, dimension, location) {
  if (!CONFIG.xp.enabled || !amount || amount <= 0) return;

  if (CONFIG.xp.deliveryMode === "orbs" && dimension && location) {
    spawnOrbs(player, dimension, location, amount);
  } else {
    grantDirect(player, amount);
  }

  // No message by default. Orbs flying in and the experience bar filling say
  // it louder than a line of chat, and the amount was already announced when
  // the grave was created.
  if (CONFIG.messages.onRecovery) {
    player.sendMessage(t("soulglass.xp.recovered", amount));
  }
}
