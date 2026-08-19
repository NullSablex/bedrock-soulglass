import { system, world } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { subscribeSafe } from "./safe.js";
import { sampleXp, forgetXp } from "./xp.js";
import { sampleEquipment, forgetEquipment } from "./equip.js";

/**
 * Sampling the player's state (XP and equipment) before death.
 *
 * Why this is not purely event-driven: the API exposes no equipment-change
 * event. Dragging a piece in the inventory screen emits nothing — that screen
 * belongs to the client and never tells the script. There is simply no hook
 * for "the player took off their chestplate".
 *
 * What does exist is better: to die, a player has to take damage. So the
 * sample rides on `entityHurt` — taken only when it might matter, instead of
 * twenty times a second for everyone standing still.
 *
 * The long-interval safety net covers a death that somehow skips `entityHurt`,
 * and runs every five seconds rather than every one.
 */

function sampleAll(player) {
  sampleXp(player);
  sampleEquipment(player);
}

export function startTracking() {
  // Main trigger: took damage, so death is on the table.
  subscribeSafe(world.afterEvents, "entityHurt", (ev) => {
    const victim = ev.hurtEntity;
    if (victim?.typeId !== "minecraft:player") return;
    sampleAll(victim);
  });

  // Safety net, deliberately sparse.
  if (CONFIG.sampling.safetyNetTicks > 0) {
    system.runInterval(() => {
      for (const player of world.getPlayers()) sampleAll(player);
    }, CONFIG.sampling.safetyNetTicks);
  }

  subscribeSafe(world.afterEvents, "playerLeave", (ev) => {
    forgetXp(ev.playerId);
    forgetEquipment(ev.playerId);
  });
}
