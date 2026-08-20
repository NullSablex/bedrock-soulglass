# Soulglass

> Death add-on for Minecraft Bedrock — your belongings wait for you where you fell — by [NullSablex](https://github.com/NullSablex)

![License](https://img.shields.io/badge/license-MPL--2.0-blue)
![Minecraft Bedrock](https://img.shields.io/badge/Bedrock-1.26+-orange)
![Script API](https://img.shields.io/badge/%40minecraft%2Fserver-2.9.0-orange)
![Packs](https://img.shields.io/badge/packs-behavior%20%2B%20resource-green)
[![Release](https://img.shields.io/github/v/release/NullSablex/bedrock-soulglass?label=download)](https://github.com/NullSablex/bedrock-soulglass/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/NullSablex/bedrock-soulglass/total?label=downloads)](https://github.com/NullSablex/bedrock-soulglass/releases)
[![Check](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/check.yml/badge.svg)](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/check.yml)
[![Docs](https://github.com/NullSablex/bedrock-soulglass/actions/workflows/docs.yml/badge.svg)](https://nullsablex.github.io/bedrock-soulglass/)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/NullSablex/bedrock-soulglass/badge)](https://scorecard.dev/viewer/?uri=github.com/NullSablex/bedrock-soulglass)

## Overview

**Soulglass** keeps what you were carrying when you died. Items and experience
go into a lantern lit where you died, and a paper guide leads you back to it.
Break the lantern and everything returns — armor going straight back onto your
body, in the slots it came from.

Nobody else can open your lantern, and nothing else in the game can destroy it.

📖 **[Full documentation](https://nullsablex.github.io/bedrock-soulglass/)**

> **Not affiliated.** This is an independent, community-maintained project. It
> is **not** affiliated with, endorsed by, sponsored by, or otherwise connected
> to Mojang Studios, Microsoft, or Minecraft. "Minecraft" and "Minecraft
> Bedrock Edition" belong to their respective owners and are referenced here
> solely to describe what this add-on is compatible with. It is not distributed
> through the Minecraft Marketplace.

**New here?** [What it does](https://nullsablex.github.io/bedrock-soulglass/features/)
walks through every feature with the reasoning behind it.

### Highlights

- **Nothing is lost** — items *and* experience, returned together.
- **Armor comes back worn**, in the original slots, and it is the exact piece
  you had on rather than an identical one from your backpack.
- **Reaches you where you are** — distance counts height, so a lantern fifty
  blocks below is fifty blocks away, not zero.
- **A guide that actually points** — distance, heading and a particle trail
  through the air, following the real line to the lantern in three dimensions.
  Sneak with it to list the lanterns in the world you are standing in; the ones
  elsewhere are counted, not spelled out as coordinates that mean somewhere else
  here.
- **Placed somewhere you can reach**, even if you died in lava, at the bottom of
  the ocean, or in the void.
- **Yours alone** — other players cannot open or break it; explosions and
  pistons leave it untouched.
- **Each player reads their own language**, resolved on their client. 11 in
  game, and the documentation home page in 10.

## Install

> **No release yet.** Nothing is tagged, so the badges above read as empty and
> the Releases page is bare. Build the packages yourself with
> `python tools/build.py --all`, or wait for the first tag.

1. Download `Soulglass_v<version>.mcaddon` from
   [Releases](https://github.com/NullSablex/bedrock-soulglass/releases/latest).
2. Open the file. The game installs both packs.
3. In your world, enable **both** the behavior pack and the resource pack.

> Enabling only the behavior pack leaves every message showing as a raw
> translation key. Both halves are required — the resource pack carries the
> translation strings.

Server owners: the release also ships each half as a separate `.mcpack`. See
[Installation](https://nullsablex.github.io/bedrock-soulglass/installation/)
for Bedrock Dedicated Server.

## How to play

You die, you respawn, you get a guide. Hold it and the action bar shows how far
the lantern is and which way to go, with a trail of light pointing there.

Reached it? **Break the lantern.** Everything comes back. The guide disappears
once you have nothing left to collect.

Sneak while holding the guide to list every lantern you have.

## Configure

Everything lives in `behavior_packs/soulglass/scripts/config.js` — marker block,
search radius, XP behaviour, protection, particles. See
[Configuration](https://nullsablex.github.io/bedrock-soulglass/configuration/).

## Contributing

```bash
python tools/check.py     # static checks
python tools/build.py --all     # writes the three release packages
```

Source language is **en-US**: comments, identifiers, the base `.lang` file.
Player-facing text never sits in the code — it goes through translation keys.

- [What it does](https://nullsablex.github.io/bedrock-soulglass/features/) —
  the full feature tour, for players, including what it deliberately does not do
- [Changelog](CHANGELOG.md) — currently **Unreleased**: everything below is on
  `master` and has not been tagged
- [Contributing guide](CONTRIBUTING.md)
- [Architecture](https://nullsablex.github.io/bedrock-soulglass/architecture/) —
  the API constraints that shaped every design decision
- [Adding a language](https://nullsablex.github.io/bedrock-soulglass/languages/)
- [AI usage policy](AI-POLICY.md)
- [Security policy](SECURITY.md) — report duplication, item loss or theft
  privately, never in a public issue

## Status

Verified in game: lantern creation, XP recovery, the guide, and protection from
other players. **Not yet verified:** the equipment restore and the translation
layer.

## License

[MPL-2.0](LICENSE). A file you modify stays open; a file you add is yours.
