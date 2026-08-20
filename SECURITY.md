# Security Policy

## What counts as a vulnerability here

This is a Minecraft add-on. It runs inside the game's scripting sandbox and
touches no network, no filesystem, and no credentials. That rules out most of
what "security issue" usually means.

What does count:

- **Item duplication.** Any sequence that ends with more items than went in.
- **Item loss.** Any sequence where a lantern, or its contents, disappears
  without the owner recovering them.
- **Theft.** Any way for a player to read, open, or destroy another player's
  lantern, or to read coordinates that are not theirs.
- **Server disruption.** Anything that can be triggered on purpose to stall or
  crash a server — entity floods, unbounded loops, dynamic property growth.

Duplication and loss are treated as the highest severity. A player losing an
inventory to a bug in an add-on meant to prevent exactly that is the worst
outcome this project has.

## What does not

- Behaviour that requires operator permissions or cheats already enabled.
- `/kill @e` destroying a vault. That is documented, and no add-on can defend
  against an operator command aimed at it.
- Anything caused by another add-on modifying the same blocks or entities.

## Reporting

**Do not open a public issue for duplication or theft.** On a live server, the
report is the exploit.

Use [private vulnerability reporting](https://github.com/NullSablex/bedrock-soulglass/security/advisories/new)
on this repository.

Useful in a report:

- The game version and whether it is single player, a Realm, or a dedicated
  server.
- The exact steps, including timing if timing matters.
- Whether other add-ons were active.
- What `config.js` values differ from the defaults.

## What to expect

- **Acknowledgement within a few days.** This is a spare-time project; there is
  no on-call rotation and no promise of an hour-scale response.
- An assessment of whether it reproduces, and where the fix goes.
- A fix released as a patch version, credited to you unless you would rather
  not be.
- The advisory published once the fix is out.

## Supported versions

The latest release only. This project has one maintainer; backporting to older
versions is not something it can honestly promise.

| Version | Supported |
|---|---|
| 1.0.x | Yes |

## OpenSSF Scorecard

The badge in the README links to an automated report. Scorecard runs the same
checks against every repository regardless of what it is, and has no verdict for
"does not apply" — a check that cannot apply scores the same 0 as a check that
was ignored.

Two of them can never apply here, and are dismissed as such in the repository's
code scanning alerts:

| Check | Why it can never apply |
|---|---|
| **Fuzzing** | Fuzzing feeds malformed input to code that parses untrusted data. This add-on parses nothing: its inputs are typed events from the game engine, already validated before a script ever sees them. It also cannot run outside Minecraft — `@minecraft/server` is supplied by the game, so there is no harness to write. |
| **CII-Best-Practices** | Requires enrolling the project in a separate external programme. It measures a registration, not anything about this code. |

Others score low without pointing at a defect. They are left open rather than
dismissed, because they describe where the project is today and will move on
their own:

| Check | What it is waiting on |
|---|---|
| **Maintained** | Repository age and commit history. Time. |
| **Code-Review** | Review by a second person. Contributors. |
| **Contributors** | Contributors from several organizations. The same. |
| **Packaging** | Publication to a package registry. Minecraft add-ons ship as `.mcaddon` files through GitHub Releases; if that ever changes, so will this. |

Everything else Scorecard measures is acted on: pinned dependencies, permissions
on workflow tokens, branch protection, secret scanning, static analysis and
build provenance are all in place, and a regression in any of them is a real
finding worth reporting through the process above.
