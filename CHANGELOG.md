# Changelog

All notable changes to this project are documented in this file.

Format inspired by [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/). Older entries live under [`changelog/`](changelog/).

## [1.0.0] — 2026/08/19

First release. Requires Minecraft Bedrock **1.26** (`@minecraft/server` 2.5.0).

Ships as two packs. **Both are required:** the behavior pack runs the logic, the resource pack carries the translation strings. Enabling only the behavior pack leaves every message showing as a raw key such as `soulglass.hud.none`.

### Added

- **A soul lantern on death.** Everything the player carried, including experience, goes into a soul lantern lit at the place they died. Break it to get it all back; there is nothing to open.
- **Armor returns worn.** Helmet, chestplate, leggings, boots and offhand go back to the slots they came from, already equipped — and it is the exact piece that was on the body, not another identical one from the backpack. Each piece is matched by a fingerprint of type, count, name, durability, enchantments and lore, so two diamond helmets are told apart by the damage the worn one took.
- **Experience is preserved and returned as collectable orbs.** `xp.mode` chooses between returning everything (`"full"`, the default) and only what vanilla would have dropped (`"vanilla"`). `deliveryMode` chooses between orbs and crediting the exact amount at once.
- **A paper guide, handed over on respawn.** Holding it shows distance, heading and height difference on the action bar, and draws a trail of particles through the air toward the lantern — following the real line, rising and falling with the terrain. A beam marks the lantern itself within 64 blocks. Sneaking while holding it lists the lanterns in the dimension you are standing in; anything elsewhere is reported as a count, never as coordinates that mean a different place here.
- **Reachable placement.** A lantern never appears inside lava or water. The search demands solid ground to stand on, headroom to swing at the marker, and no liquid touching it, searching outward from the death point for the nearest safe block, the way a bed finds a respawn spot. Dying in the void or mid-ocean builds a support block rather than leaving the lantern where nobody can reach it.
- **Only the owner can open a lantern**, and nothing else in the game can destroy one. Explosions have the lantern's blocks removed from their affected list, so TNT still goes off and leaves it untouched. Pistons cannot push the marker away from the vault pinned beneath it. **The block holding the lantern up counts as part of it** — a soul lantern needs support, so knocking the ground out would pop it off as an ordinary item, and the break event fires for the ground rather than the marker, so nothing would notice. Both blocks now resolve to the same lantern: the owner breaking either one gets everything back, anyone else is stopped at both, and neither drops. A lantern lit on gravel or sand gets a solid block put under it, because those fall: the whole column dropping would take the lantern with it, reported as a break somewhere else entirely. Whatever prevention cannot reach is caught by a sweep that puts a missing marker back, because the registry decides where a lantern stands, not the world.
- **Per-player translation.** Messages are translation keys the client resolves, so two players side by side read the same line each in their own language. 11 languages ship, from English and Portuguese to Russian, Chinese and Japanese; any other language falls back to English, so nobody ever sees a raw key.
- **`/scriptevent soulglass:find`** lists the caller's lanterns. Sneaking with the guide does the same thing and needs no cheats.
- **Documentation site** built with MkDocs Material, split by audience: players, server owners, developers. [What it does](docs/features.md) is the player-facing tour: every feature, why it exists, and an honest list of what the add-on does not do. Screenshots open full size, link previews render as cards, and the site itself is translatable — a page with no translation falls back to English rather than disappearing. [`docs/architecture.md`](docs/architecture.md) records the API constraints behind each design decision.
- **`tools/check.py`** — static analysis covering what can be checked without running the game: imports resolving, config keys existing, translation keys present in every language file, characters that would break the in-game font, JSON validity, and side effects that would throw inside `beforeEvents`.
- **`tools/build.py`** — produces the release packages on Windows, Linux and macOS alike. Three of them: the `.mcaddon` that installs both halves at once, and each half as its own `.mcpack` for server owners placing them by hand.
- **Build provenance on every release artifact.** Each package is signed against the commit, workflow and runner that produced it, so a download can be traced back to this repository rather than to someone who repacked it: `gh attestation verify Soulglass_v1.0.0.mcaddon --repo NullSablex/bedrock-soulglass`.

### Notes

- **Nothing happens when `keepInventory` is on.** That rule preserves experience as well as items, so creating a lantern would hand back XP the player never lost.
- **`/kill @e` destroys the vault** and its items are lost. The experience is still returned and the player is told, rather than being handed an empty lantern in silence. This is the one fragility a block-based design would not have had; it is the price of an inventory that holds exactly what a player carries and cannot be opened.
- **The marker must be breakable by hand.** `playerBreakBlock` only fires when the block would actually break, and someone who just died has no pickaxe — it is inside the lantern. Changing `markerBlocks` to something like crying obsidian makes lanterns unrecoverable forever.
- **Inventory layout is not restored**, only equipment slots. Items come back in the order they sat in the vault.
- **The guide's item name and lore are not translated.** Item text takes plain strings only; the API rejects translation keys there. They come from `config.js` and read the same for everyone.
- **`xpPerOrb` is an assumption.** The API never exposes an orb's value, so the count is derived rather than measured. Verify it against a known amount and adjust, or switch `deliveryMode` to `"direct"` for exactness.

[1.0.0]: https://github.com/NullSablex/bedrock-soulglass/releases/tag/v1.0.0
