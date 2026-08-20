import { world } from "@minecraft/server";
import { CONFIG } from "./config.js";

/**
 * The lantern registry, persisted in a world dynamic property.
 * It survives a server restart; an in-memory Map would not.
 */
const KEY = "soulglass:records";

function readAll() {
  try {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw !== "string" || !raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt registry must not take the addon down: start over empty.
    console.warn("[Soulglass] unreadable registry, starting empty");
    return [];
  }
}

function writeAll(list) {
  try {
    world.setDynamicProperty(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn(`[Soulglass] failed to write the registry: ${e}`);
  }
}

/** Short position key, to match a block to a lantern without scanning. */
export function posKey(dimensionId, loc) {
  return `${dimensionId}|${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/**
 * Records a new lantern.
 *
 * There is NO pruning by count, and that is deliberate. The registry is the
 * only thing tying a block in the world to its owner: without it the marker
 * becomes an ordinary lantern anyone can break, hiding a vault full of items
 * nobody can reach. Dropping the record does not remove the lantern — it
 * abandons it.
 *
 * A lantern leaves the registry through exactly one path: its owner recovering
 * the contents.
 */
export function addLantern(record) {
  const list = readAll();
  list.push(record);
  writeAll(list);

  const mine = list.filter((g) => g.ownerId === record.ownerId);
  if (mine.length >= CONFIG.warnAfterLanterns) {
    console.warn(
      `[Soulglass] ${record.ownerName} has ${mine.length} lanterns left to recover`
    );
  }
}

export function lanternAt(dimensionId, loc) {
  const key = posKey(dimensionId, loc);
  return readAll().find((g) => g.key === key);
}

/** Every lantern in the world, for sweeps that are not tied to one player. */
export function allLanterns() {
  return readAll();
}

export function lanternsOf(ownerId) {
  return readAll().filter((g) => g.ownerId === ownerId);
}

export function removeLantern(key) {
  const list = readAll();
  const index = list.findIndex((g) => g.key === key);
  if (index >= 0) {
    list.splice(index, 1);
    writeAll(list);
  }
}
