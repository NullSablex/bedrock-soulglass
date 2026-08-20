# Installation

## Minecraft (Windows, iOS, Android, console)

1. Download `Soulglass_v<version>.mcaddon` from the
   [Releases page](https://github.com/NullSablex/bedrock-soulglass/releases).
2. Open the file. Minecraft installs both packs automatically.
3. Edit your world → **Behavior Packs** → activate **Soulglass**.
4. Edit your world → **Resource Packs** → activate **Soulglass**.

!!! warning "Both packs are required"
    The resource pack carries the translation strings. With only the behavior
    pack active, every message appears as a raw key such as
    `soulglass.hud.none`.

## Checking a download is genuine

Optional, and nobody needs it to play. It matters because this add-on handles
everything a player is carrying, which makes it worth repacking with something
extra and reposting on a download site — and a `.mcaddon` is a zip, so anyone
can open one, change it and close it again.

Every release carries a `provenance.intoto.jsonl` file. It is not something to
install: it records which workflow built each package, from which commit, and
the exact SHA-256 of each file, signed by GitHub's own build identity rather
than by a key the maintainer keeps.

With the [GitHub CLI](https://cli.github.com/) installed:

```bash
gh attestation verify Soulglass_v1.0.0.mcaddon --repo NullSablex/bedrock-soulglass
```

A genuine file prints a confirmation and exits 0. A file that was modified,
even by one byte, fails — its hash matches no attestation, so there is nothing
to check it against:

```
Error: HTTP 404: Not Found (.../attestations/sha256:8cf37be5...)
```

The point is that this needs no trust in the maintainer, in the site you
downloaded from, or in this page. The signature is verified against a public
transparency log; either the file came out of this repository or it did not.

!!! note "Only for files from Releases"
    Packages you built yourself with `tools/build.py` have no attestation and
    will fail the same way. That is expected — nothing signed them.

## Bedrock Dedicated Server

BDS does not read `.mcaddon`. Extract it and place each half by hand:

```
<server>/behavior_packs/soulglass/
<server>/resource_packs/soulglass/
```

### Finding the packs is automatic. Applying them is not.

On startup the server scans `behavior_packs/` and `resource_packs/`, and writes
what it finds into `valid_known_packs.json` itself. **Nothing needs adding to
that file** — editing it by hand is a common piece of advice and it is wrong,
because the server rewrites it.

What discovery does not do is decide which packs a *world* uses. That lives
with the world, so that two worlds on one server can run different packs, and
it is declared here:

```json title="worlds/<world>/world_behavior_packs.json"
[
  { "pack_id": "b41d7a9c-3e26-4f80-95a7-1c8d0b6e2f43", "version": [1, 0, 0] }
]
```

```json title="worlds/<world>/world_resource_packs.json"
[
  { "pack_id": "0c7a1e46-8b52-4d93-a1f7-26e0b9c4d385", "version": [1, 0, 0] }
]
```

`<world>` is the `level-name` from `server.properties`, and the `pack_id`
values are the `header.uuid` of each manifest — copied above so you do not have
to open them. If either file already exists, add the object to the list rather
than replacing the file.

Restart the server. The log should show `[Soulglass] ready`.

!!! tip "If your host does this for you"
    Panels and managed hosts commonly write these two files when you upload an
    add-on, which makes it look as though dropping the folders in was enough.
    It is worth checking the files exist before concluding the add-on is
    broken — a pack that is present but not applied loads no scripts at all,
    and the symptom is silence rather than an error.

## Development install

A junction lets the game read straight from your clone, so an edit takes effect
the next time you enter the world.

=== "Windows"

    ```powershell
    $mojang = "$env:APPDATA\Minecraft Bedrock\Users\Shared\games\com.mojang"
    New-Item -ItemType Junction `
      -Path "$mojang\development_behavior_packs\soulglass" `
      -Target "$PWD\behavior_packs\soulglass"
    New-Item -ItemType Junction `
      -Path "$mojang\development_resource_packs\soulglass" `
      -Target "$PWD\resource_packs\soulglass"
    ```

=== "Linux (BDS)"

    ```bash
    ln -s "$PWD/behavior_packs/soulglass"  /path/to/bds/behavior_packs/soulglass
    ln -s "$PWD/resource_packs/soulglass"  /path/to/bds/resource_packs/soulglass
    ```

!!! info "Path changed in 1.26"
    The Windows Store edition no longer stores data in
    `LocalState\games\com.mojang`. It now lives under
    `%APPDATA%\Minecraft Bedrock\`, with worlds separated per account profile.

## Troubleshooting

**The pack loads but nothing happens.** Turn on **Content Log GUI** under
Settings → Creator. Every event subscription is isolated, so a failure names
itself in the log instead of silently killing the add-on.

**Messages show as raw keys.** The resource pack is not active.

**`/scriptevent` says the command does not exist.** Cheats are disabled in that
world. Using the guide does the same job without cheats.
