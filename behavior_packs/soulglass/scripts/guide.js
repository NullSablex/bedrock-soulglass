import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { subscribeSafe } from "./safe.js";
import { lanternsOf } from "./storage.js";
import { hintActive } from "./hud.js";
import { isNote, holdingNote, refreshNote } from "./note.js";
import { showMenu } from "./menu.js";
import { listLanterns } from "./chat.js";
import { nearestLantern, groundDistanceTo } from "./distance.js";
import { t, tn, join, raw } from "./msg.js";

/**
 * Guiding the player back: action bar, particle trail and the chat listing.
 *
 * All of it depends on holding the guide. Nothing here writes to the item — the
 * numbers come from the registry every time.
 */

const HEADINGS = [
  "soulglass.dir.0", "soulglass.dir.1", "soulglass.dir.2", "soulglass.dir.3",
  "soulglass.dir.4", "soulglass.dir.5", "soulglass.dir.6", "soulglass.dir.7",
];

function lanternsHere(player) {
  return lanternsOf(player.id).filter((g) => g.dimension === player.dimension.id);
}

/** Heading relative to where the player is looking — "ahead", not "north". */
function headingTo(player, lantern) {
  const dx = lantern.x - player.location.x;
  const dz = lantern.z - player.location.z;

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
  if (distance <= CONFIG.note.arrivedWithin) return t("soulglass.hud.arrived");

  const dy = Math.round(near.lantern.y - player.location.y);

  /*
   * Standing on top of it, or under it, there is no direction to give. A
   * bearing computed from a metre of horizontal offset points wherever the
   * rounding fell, and sends the player walking away from what is beneath
   * their feet.
   */
  const ground = groundDistanceTo(player, near.lantern);
  const heading = ground >= CONFIG.note.headingBeyond
    ? join(raw(" §8- §e"), t(headingTo(player, near.lantern)))
    : undefined;

  return join(
    t("soulglass.hud.prefix"),
    tn(distance, "soulglass.blocks.one", "soulglass.blocks.many"),
    heading,
    dy > 1 ? t("soulglass.hud.above", dy) : undefined,
    dy < -1 ? t("soulglass.hud.below", -dy) : undefined
  );
}

/**
 * The trail follows the straight line to the lantern, rising and falling with
 * it — which is why it beats an arrow, which only orients on the flat.
 */
function drawTrail(player, lantern) {
  const cfg = CONFIG.note.trail;
  if (!cfg?.enabled) return;

  const from = player.getHeadLocation();
  const dx = lantern.x + 0.5 - from.x;
  const dy = lantern.y + 0.5 - from.y;
  const dz = lantern.z + 0.5 - from.z;
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

function drawBeacon(player, lantern, distance) {
  const cfg = CONFIG.note.beacon;
  if (!cfg?.enabled || distance > cfg.visibleWithin) return;

  for (let i = 0; i < cfg.height; i++) {
    try {
      player.dimension.spawnParticle(cfg.particle, {
        x: lantern.x + 0.5,
        y: lantern.y + 0.5 + i,
        z: lantern.z + 0.5,
      });
    } catch { /* chunk unloaded */ }
  }
}

function statusFor(player) {
  const near = nearestLantern(player, lanternsHere(player));
  if (near) return actionBarLine(player, near);

  const elsewhere = lanternsOf(player.id).length;
  return elsewhere > 0
    ? tn(elsewhere, "soulglass.hud.other_dimension.one", "soulglass.hud.other_dimension.many")
    : t("soulglass.hud.none");
}

/**
 * The menu, or the chat when the menu is turned off.
 *
 * A static import on purpose. Dynamic import would degrade more gracefully on
 * a version without @minecraft/server-ui, but it is not a feature of this
 * script engine that can be relied on, and the module is a declared manifest
 * dependency exactly like @minecraft/server. showMenu falls back to chat on
 * its own if a form cannot be shown.
 */
function open(player) {
  if (CONFIG.menu.enabled) showMenu(player);
  else listLanterns(player);
}

export function registerGuide() {
  if (!CONFIG.note.enabled) return;

  // Particles run further apart than the action bar: they are the costly part.
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (!holdingNote(player)) continue;
      const near = nearestLantern(player, lanternsHere(player));
      if (!near) continue;
      drawTrail(player, near.lantern);
      drawBeacon(player, near.lantern, near.distance);
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

      // A hud.js notice outranks the guide; without yielding, both would write
      // to the same bar on different intervals and the text would flicker.
      if (!hintActive(player)) {
        player.onScreenDisplay.setActionBar(statusFor(player));
      }

      /*
       * Sneaking opens the menu. Paper has no use action of its own, so
       * `itemUse` may never fire for it — unlike a compass. This trigger
       * depends on no item event at all, which makes it the reliable path.
       */
      const before = wasSneaking.get(player.id) === true;
      const now = player.isSneaking === true;
      wasSneaking.set(player.id, now);
      if (now && !before) open(player);
    }
  }, CONFIG.note.refreshTicks);

  subscribeSafe(world.afterEvents, "itemUse", (ev) => {
    if (isNote(ev.itemStack)) open(ev.source);
  });
}
