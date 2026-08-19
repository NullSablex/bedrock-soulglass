# Soulglass

[![check](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/check.yml/badge.svg)](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/check.yml)
[![docs](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/docs.yml/badge.svg)](https://nullsablex.github.io/bedrock-soulglass/)

Death add-on for **Minecraft Bedrock 1.26**. Your belongings stay behind in a
grave marked by a soul lantern, and a map leads you back to them.

📖 **[Full documentation](https://nullsablex.github.io/bedrock-soulglass/)**

---

## Features

- Items **and experience** are kept in the grave.
- Armor and offhand come back **already worn**, in the same slots.
- A **map** is handed to you on respawn: distance, heading and a particle trail.
- **Only you** can open your grave. TNT, creepers and pistons cannot touch it.
- Always placed somewhere **reachable**, even if you die in lava or at sea.
- **Translated per player** — each one reads their own language.

## Install

1. Download `Soulglass_v1.0.0.mcaddon` from
   [Releases](https://github.com/NullSablex/bedrock-soulglass/releases).
2. Open the file. The game installs both packs.
3. In your world, enable **both** the behavior pack and the resource pack.

> Enabling only the behavior pack leaves every message showing as a raw
> translation key. Both halves are required.

Server owners: see [Installation](https://nullsablex.github.io/bedrock-soulglass/installation/)
for Bedrock Dedicated Server.

## How to play

You die, you respawn, you get a map. Hold it and the action bar shows how far
away the grave is and which way to go, with a trail of light pointing there.

Reached it? **Break the lantern.** Everything comes back, armor included. The
map disappears once you have nothing left to collect.

Sneak while holding the map to list every grave you have.

## Configure

Everything lives in `behavior_packs/soulglass/scripts/config.js` — marker block,
search radius, XP behaviour, protection, particles. See
[Configuration](https://nullsablex.github.io/bedrock-soulglass/configuration/).

## Contributing

```bash
python tools/check.py     # static checks
python build.py           # writes dist/Soulglass_v<version>.mcaddon
```

Source language is **en-US**: comments, identifiers and the base `.lang` file.
Player-facing text never sits in the code — it goes through translation keys.

Adding a language is one file: see
[Languages](https://nullsablex.github.io/bedrock-soulglass/languages/).
Working on the code: see
[Architecture](https://nullsablex.github.io/bedrock-soulglass/architecture/),
which records the API constraints that shaped the design.

## Status

Verified in game: grave creation, XP recovery, the map, protection from other
players. **Not yet verified:** equipment restore and the translation layer.

## License

[MIT](LICENSE)
