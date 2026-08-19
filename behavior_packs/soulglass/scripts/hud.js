import { system } from "@minecraft/server";

/**
 * Short notices on the action bar, with a guard against repetition.
 *
 * This came out of a real bug: the "break the grave" hint went to the chat on
 * every `playerInteractWithBlock`. One click produced one line; holding the
 * button produced a flood.
 *
 * Two decisions fix it:
 *
 * 1. Action bar instead of chat. It overwrites itself and leaves no history,
 *    which is what an ephemeral notice wants. Chat is for what the player may
 *    want to read again.
 *
 * 2. A per-player lock. While the same notice is still showing, repeating it
 *    does nothing. Without that the bar would flicker on every tick of a held
 *    button.
 */

const showing = new Map();

/**
 * Shows a notice, ignoring repeats until the previous one expires.
 * @returns true when the notice was actually displayed now
 */
export function showHint(player, message, durationTicks = 40) {
  const now = system.currentTick;
  const key = JSON.stringify(message);
  const previous = showing.get(player.id);

  // Same notice still on screen: do not resend.
  if (previous && previous.key === key && previous.expires > now) return false;

  try {
    player.onScreenDisplay.setActionBar(message);
  } catch {
    return false;
  }
  showing.set(player.id, { key, expires: now + durationTicks });
  return true;
}

/** Is a notice occupying the action bar right now? */
export function hintActive(player) {
  const current = showing.get(player.id);
  return current !== undefined && current.expires > system.currentTick;
}

export function forgetHints(playerId) {
  showing.delete(playerId);
}
