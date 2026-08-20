import { lanternsOf } from "./storage.js";
import { distanceTo, byDistance } from "./distance.js";
import { t, tn, join, raw } from "./msg.js";

/**
 * The listing as chat lines.
 *
 * Its own module so the menu can offer it without importing the guide and the
 * guide can fall back to it without importing the menu. Those two importing
 * each other worked, but only because every use was deferred into a function
 * body — a property nobody should have to verify to make a change.
 */

function lanternsHere(player) {
  return lanternsOf(player.id).filter((l) => l.dimension === player.dimension.id);
}

/**
 * Where the lantern is and how far away it is. Nothing else.
 *
 * The experience it holds used to be on this line. It answered a question
 * nobody asks: the amount changes no decision, because every lantern is worth
 * walking to and the XP comes back either way.
 */
function lanternLine(player, lantern) {
  return join(
    raw(`  §8- §f${lantern.x} ${lantern.y} ${lantern.z}  §8- §f`),
    tn(Math.round(distanceTo(player, lantern)), "soulglass.blocks.one", "soulglass.blocks.many")
  );
}

/**
 * Lists only the lanterns in the dimension the player is standing in.
 *
 * Anything elsewhere is unreachable from here without a portal, so listing it
 * is noise — coordinates the player cannot act on, and worse, coordinates that
 * mean a different place in the world they are in.
 *
 * When nothing is lit here but something is lit elsewhere, that is worth one
 * line: otherwise the player reads "you have none" and concludes their loot is
 * gone.
 */
export function listLanterns(player) {
  const here = lanternsHere(player);
  if (here.length === 0) {
    const elsewhere = lanternsOf(player.id).length;
    player.sendMessage(
      elsewhere > 0
        ? tn(elsewhere, "soulglass.list.elsewhere.one", "soulglass.list.elsewhere.many")
        : t("soulglass.list.none")
    );
    return;
  }

  player.sendMessage(
    here.length === 1 ? t("soulglass.list.one") : t("soulglass.list.many", here.length)
  );

  for (const lantern of byDistance(player, here)) {
    player.sendMessage(lanternLine(player, lantern));
  }
}

