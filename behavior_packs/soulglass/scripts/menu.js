import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "./config.js";
import { lanternsOf } from "./storage.js";
import { distanceTo, byDistance } from "./distance.js";
import { listLanterns } from "./chat.js";
import { t, tn, join, raw } from "./msg.js";

/**
 * The menu the guide opens.
 *
 * Chat was the only surface this add-on had, and chat is a bad place to be
 * read: the lines scroll away behind whatever anyone says next, and there is
 * nowhere to put anything that is not urgent. A form holds still until it is
 * dismissed, which is what makes a credits screen possible at all — the game
 * offers no other place to name an author.
 *
 * Chat is still one button away, because a list you can copy coordinates out
 * of beats a list that vanishes when you close it.
 */

/** A horizontal rule. Hyphens only: box-drawing characters change the font. */
const RULE = "-".repeat(28);

/**
 * Forms refuse to open while the player is holding a key or already looking at
 * one, and report it as a cancellation rather than an error.
 *
 * The player is not doing anything wrong in that case — they are mid-sneak,
 * which is exactly the gesture that asked for this menu. So it retries for a
 * moment instead of failing silently, and gives up quietly rather than
 * badgering someone who walked away.
 */
function showBusy(player, form, onSelect, attempt = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && attempt < CONFIG.menu.retries) {
        system.runTimeout(
          () => showBusy(player, form, onSelect, attempt + 1),
          CONFIG.menu.retryTicks
        );
      }
      return;
    }
    onSelect(response.selection);
  }).catch(() => { /* player left, or forms unavailable in this version */ });
}

/** A button with its icon, or without one when the path is unset. */
function button(form, label, icon) {
  return icon ? form.button(label, icon) : form.button(label);
}

function lanternsHere(player) {
  return lanternsOf(player.id).filter((l) => l.dimension === player.dimension.id);
}

/** One button per lantern: coordinates on top, distance underneath. */
function lanternButton(player, lantern) {
  return join(
    raw(`${lantern.x}  ${lantern.y}  ${lantern.z}\n§7`),
    tn(Math.round(distanceTo(player, lantern)), "soulglass.blocks.one", "soulglass.blocks.many")
  );
}

function showLanterns(player) {
  const here = byDistance(player, lanternsHere(player));
  const form = new ActionFormData().title(t("soulglass.menu.lanterns"));

  if (here.length === 0) {
    const elsewhere = lanternsOf(player.id).length;
    form.body(
      elsewhere > 0
        ? tn(elsewhere, "soulglass.list.elsewhere.one", "soulglass.list.elsewhere.many")
        : t("soulglass.list.none")
    );
    button(form, t("soulglass.menu.back"), CONFIG.menu.icons.back);
    showBusy(player, form, () => showMenu(player));
    return;
  }

  form.body(t("soulglass.menu.lanterns.body"));
  for (const lantern of here) {
    button(form, lanternButton(player, lantern), CONFIG.menu.icons.lanterns);
  }
  button(form, t("soulglass.menu.back"), CONFIG.menu.icons.back);

  // Every button but the last is a lantern, and picking one only closes the
  // menu: the guide already points at the nearest, and walking is the game.
  showBusy(player, form, (selection) => {
    if (selection === here.length) showMenu(player);
  });
}

/**
 * Credits, laid out rather than listed.
 *
 * A Bedrock add-on has nowhere else to put an author: no about screen, a pack
 * description nobody opens, and item names that are plain strings shared by
 * every language. A form is the one surface in the game where this can be read.
 *
 * A form body is a single blob of text with no styling beyond colour codes and
 * newlines, so structure has to be built by hand — a rule between blocks,
 * labels dimmer than the values they introduce, and the disclaimer set apart at
 * the bottom. Read as a run-on paragraph it looks like nobody cared.
 */
function showCredits(player) {
  const c = CONFIG.credits;

  const form = new ActionFormData()
    .title(t("soulglass.credits.title"))
    .body(join(
      raw(`§b§l${c.name}§r\n§3${RULE}\n\n`),
      t("soulglass.credits.tagline"), raw("\n\n"),

      t("soulglass.credits.by"), raw(`  §f§l${c.author}§r\n`),
      t("soulglass.credits.version"), raw(`  §f${c.version}\n`),
      t("soulglass.credits.license"), raw(`  §f${c.license}\n\n`),

      raw(`§3${RULE}\n\n`),
      t("soulglass.credits.source"), raw(`\n§b${c.repo}\n\n`),
      t("soulglass.credits.translators"), raw("\n\n§8"),
      t("soulglass.credits.disclaimer")
    ));

  button(form, t("soulglass.credits.link"), CONFIG.menu.icons.link);
  button(form, t("soulglass.menu.back"), CONFIG.menu.icons.back);

  showBusy(player, form, (selection) => {
    if (selection === 0) sendLink(player);
    else showMenu(player);
  });
}

/**
 * The address, on its own line in chat.
 *
 * Bedrock has no clickable link and no clipboard: ActionFormData renders plain
 * text, and no script API opens a browser. Chat is as close as the game gets,
 * because chat is the one surface a player can select text out of.
 */
function sendLink(player) {
  player.sendMessage(join(
    t("soulglass.credits.source"), raw(`\n§b${CONFIG.credits.url}`)
  ));
}

export function showMenu(player) {
  const here = lanternsHere(player).length;

  const form = new ActionFormData()
    .title(t("soulglass.menu.title"))
    .body(here > 0
      ? tn(here, "soulglass.menu.body.one", "soulglass.menu.body.many")
      : t("soulglass.menu.body.none"));

  button(form, t("soulglass.menu.lanterns"), CONFIG.menu.icons.lanterns);
  button(form, t("soulglass.menu.chat"), CONFIG.menu.icons.chat);
  button(form, t("soulglass.credits.title"), CONFIG.menu.icons.credits);

  showBusy(player, form, (selection) => {
    if (selection === 0) showLanterns(player);
    else if (selection === 1) listLanterns(player);
    else if (selection === 2) showCredits(player);
  });
}
