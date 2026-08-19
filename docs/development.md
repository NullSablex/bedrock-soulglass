# Development

## Requirements

Python 3.9+ for the build and the checks. That is all — no Node dependency, no
bundler.

## Commands

```bash
python tools/check.py     # static analysis
python build.py           # writes dist/Soulglass_v<version>.mcaddon
```

Both behave identically on Windows, Linux and macOS.

## What check.py catches

JavaScript is never executed outside the game, so the checks cover what static
analysis can reach. Each rule exists because that failure has happened here at
least once:

| Check | Failure it prevents |
|---|---|
| Imports resolve and names are exported | A rename applied to only half the files |
| `CONFIG` keys exist | A config key renamed in one place |
| Translation keys exist in **every** `.lang` | A player reading a raw key |
| Characters stay within Latin-1 | A line drawn in the fallback font |
| JSON parses | A pack that silently refuses to load |
| `entities/` implies a `data` module | An entity definition never read |
| Brackets balance | A truncated edit |
| No side effects outside `system.run` in `beforeEvents` | A runtime throw |

It is not a substitute for playing. Nothing here proves behaviour.

## Conventions

**Source language is en-US** — comments, identifiers, the base `.lang` file.

**Player text never sits in the code.** It goes through a translation key. The
only exceptions are the item name and lore, which the API forbids translating.

**Comments explain why, not what.** A comment restating the line below it is
noise. A comment recording a constraint the reader could not recover on their
own stays — most of [Architecture](architecture.md) began life as one.

**One responsibility per module.** When a file starts answering two questions,
split it.

## Build output

`build.py` produces a single `.mcaddon`: a ZIP holding both packs, each in its
own top-level folder.

Entry names use forward slashes deliberately. PowerShell's `Compress-Archive`
writes backslashes, which violates the ZIP spec and gets the package rejected by
several clients and by BDS. That is also why the build is Python and not a shell
script: Git Bash on Windows ships no `zip`, and its GNU tar cannot produce ZIP
archives.

## Testing in game

Use a junction so the game reads from your clone — see
[Installation](installation.md#development-install). Changes take effect when you
re-enter the world; there is no hot reload.

Turn on **Content Log GUI** under Settings → Creator. Without it a script error
is invisible.

Cases worth testing specifically:

- Two identical armor pieces, one worn and one in the backpack. The worn one
  must be the one that returns.
- Dying twice before recovering anything.
- Dying in lava, in deep ocean, and in the void.
- `keepInventory` on: no grave at all, and experience untouched.
- Handing your map to another player: it must show *their* graves, not yours.

## Releasing

1. Bump `version` in both manifests.
2. `python tools/check.py`
3. `python build.py`
4. Tag and attach the `.mcaddon` to a GitHub release.

Both manifests carry their own version; the build reads the behavior pack's.
