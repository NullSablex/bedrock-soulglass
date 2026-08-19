/**
 * Translated messages.
 *
 * No finished text in the code: we send a KEY, and the client resolves it in
 * its own language. Two players standing side by side read the same message
 * each in their own tongue, and the server never needs to know which — there
 * is no API to ask a player for their locale, and with this design it never
 * comes up.
 *
 * The keys live in soulglass_RP/texts/*.lang, and they have to live in the
 * RESOURCE pack: the client resolves them, and clients never receive behavior
 * packs. That is why this addon stopped being behavior-pack-only.
 *
 * Two things stay out, because of an API limit: item `nameTag` and `setLore`
 * take plain strings, never RawMessage. The map's name and lore use the single
 * language set in config.js, the same for everyone.
 */

/** A key with its arguments. Everything becomes a string, as .lang expects. */
export function t(key, ...args) {
  return { translate: key, with: args.map((a) => String(a)) };
}

/**
 * Picks between a singular and a plural key.
 *
 * A .lang file has no plural rules, so the choice happens here and each
 * language writes both forms. Languages with more than two plural forms would
 * need extra keys; none of the supported ones do.
 */
export function tn(n, keyOne, keyMany, ...extra) {
  return Math.abs(n) === 1 ? t(keyOne, ...extra) : t(keyMany, n, ...extra);
}

/** Glues several parts into a single line. */
export function join(...parts) {
  return { rawtext: parts.filter((p) => p !== undefined) };
}

/** Literal text, for what is never translated: coordinates, player names. */
export function raw(text) {
  return { text: String(text) };
}

/**
 * Dimension name as a key, or undefined for an unknown dimension.
 *
 * Spelled out rather than assembled by concatenation, so every key appears as
 * a literal in the source. That is what lets the static check confirm each one
 * exists in every .lang file — a key built at runtime is invisible to it.
 */
const DIMENSION_KEYS = {
  "minecraft:overworld": "soulglass.dim.overworld",
  "minecraft:nether": "soulglass.dim.nether",
  "minecraft:the_end": "soulglass.dim.the_end",
};

export function dimensionKey(dimensionId) {
  return DIMENSION_KEYS[dimensionId];
}
