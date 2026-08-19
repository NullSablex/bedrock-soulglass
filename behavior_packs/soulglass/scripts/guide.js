import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { subscribeSafe } from "./safe.js";
import { gravesOf } from "./storage.js";
import { hintActive } from "./hud.js";
import { isNote, holdingNote, refreshNote } from "./note.js";
import { distanceTo, byDistance, nearestGrave } from "./distance.js";
import { t, tn, join, raw, dimensionKey } from "./msg.js";

/**
 * Guiding the player back: action bar, particle trail and the chat listing.
 *
 * All of it depends on holding the map. Nothing here writes to the item — the
 * numbers come from the registry every time.
 */

const HEADINGS = [
  "soulglass.dir.0", "soulglass.dir.1", "soulglass.dir.2", "soulglass.dir.3",
  "soulglass.dir.4", "soulglass.dir.5", "soulglass.dir.6", "soulglass.dir.7",
];

function gravesHere(player) {
  return gravesOf(player.id).filter((g) => g.dimension === player.dimension.id);
}

/** Heading relative to where the player is looking — "ahead", not "north". */
function headingTo(player, grave) {
  const dx = grave.x - player.location.x;
  const dz = grave.z - player.location.z;

  const target = Math.atan2(-dx, dz) * (180 / Math.PI);
  let relative = target - player.getRotation().y;
  while (relative < 0) relative += 360;
  while (relative >= 360) relative -= 360;

  return HEADINGS[Math.round(relative / 45) % 8];
}

/**
 * Assembled from parts rather than one key with placeholders: `with` only
 * accepts strings, so a translated fragment cannot nest inside another
 * translation. Each piece resolves on its own, in order.
 */
function actionBarLine(player, near) {
  const distance = Math.round(near.distance);
  if (distance <= 2) return t("soulglass.hud.arrived");

  const dy = Math.round(near.grave.y - player.location.y);
  return join(
    t("soulglass.hud.prefix"),
    tn(distance, "soulglass.blocks.one", "soulglass.blocks.many"),
    raw(" §8- §e"),
    t(headingTo(player, near.grave)),
    dy > 1 ? t("soulglass.hud.above", dy) : undefined,
    dy < -1 ? t("soulglass.hud.below", -dy) : undefined
  );
}

/**
 * The trail follows the straight line to the grave, rising and falling with
 * it — which is why it beats an arrow, which only orients on the flat.
 */
function drawTrail(player, grave) {
  const cfg = CONFIG.note.trail;
  if (!cfg?.enabled) return;

  const from = player.getHeadLocation();
  const dx = grave.x + 0.5 - from.x;
  const dy = grave.y + 0.5 - from.y;
  const dz = grave.z + 0.5 - from.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length < 1) return;

  const steps = Math.min(cfg.length, Math.floor(length));
  for (let i = 1; i <= steps; i++) {
    try {
      player.dimension.spawnParticle(cfg.particle, {
        x: from.x + (dx / length) * i,
        y: from.y + (dy / length) * i,
        z: from.z + (dz / length) * i,
      });
    } catch { /* particle missing or chunk unloaded */ }
  }
}

function drawBeacon(player, grave, distance) {
  const cfg = CONFIG.note.beacon;
  if (!cfg?.enabled || distance > cfg.visibleWithin) return;

  for (let i = 0; i < cfg.height; i++) {
    try {
      player.dimension.spawnParticle(cfg.particle, {
        x: grave.x + 0.5,
        y: grave.y + 0.5 + i,
        z: grave.z + 0.5,
      });
    } catch { /* chunk unloaded */ }
  }
}

export function listGraves(player) {
  const mine = gravesOf(player.id);
  if (mine.length === 0) {
    player.sendMessage(t("soulglass.list.none"));
    return;
  }

  player.sendMessage(
    mine.length === 1 ? t("soulglass.list.one") : t("soulglass.list.many", mine.length)
  );

  for (const grave of byDistance(player, mine)) {
    const distance = distanceTo(player, grave);
    const where = distance !== Infinity
      ? tn(Math.round(distance), "soulglass.blocks.one", "soulglass.blocks.many")
      : dimensionKey(grave.dimension)
        ? t(dimensionKey(grave.dimension))
        : raw(grave.dimension.replace("minecraft:", ""));

    player.sendMessage(join(
      raw(`  §8- §f${grave.x} ${grave.y} ${grave.z} §8- §f`),
      where,
      grave.xp > 0 ? t("soulglass.list.xp", grave.xp) : undefined
    ));
  }
}

function statusFor(player) {
  const near = nearestGrave(player, gravesHere(player));
  if (near) return actionBarLine(player, near);

  const elsewhere = gravesOf(player.id).length;
  return elsewhere > 0
    ? t("soulglass.hud.other_dimension", elsewhere)
    : t("soulglass.hud.none");
}

export function registerGuide() {
  if (!CONFIG.note.enabled) return;

  // Particles run further apart than the action bar: they are the costly part.
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (!holdingNote(player)) continue;
      const near = nearestGrave(player, gravesHere(player));
      if (!near) continue;
      drawTrail(player, near.grave);
      drawBeacon(player, near.grave, near.distance);
    }
  }, CONFIG.note.trail?.everyTicks ?? 10);

  const wasSneaking = new Map();
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (!holdingNote(player)) {
        wasSneaking.delete(player.id);
        continue;
      }

      refreshNote(player);

      // A hud.js notice outranks the map; without yielding, both would write
      // to the same bar on different intervals and the text would flicker.
      if (!hintActive(player)) {
        player.onScreenDisplay.setActionBar(statusFor(player));
      }

      /*
       * Sneaking lists everything in chat. Paper has no use action of its own,
       * so `itemUse` may never fire for it — unlike a compass. This trigger
       * depends on no item event at all, which makes it the reliable path.
       */
      const before = wasSneaking.get(player.id) === true;
      const now = player.isSneaking === true;
      wasSneaking.set(player.id, now);
      if (now && !before) listGraves(player);
    }
  }, CONFIG.note.refreshTicks);

  subscribeSafe(world.afterEvents, "itemUse", (ev) => {
    if (isNote(ev.itemStack)) listGraves(ev.source);
  });
}
