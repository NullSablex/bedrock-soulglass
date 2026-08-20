# Configuration

Everything lives in one file:
`behavior_packs/soulglass/scripts/config.js`. Edit it and restart the world.

## The lantern block

```js
markerBlocks: [
  "minecraft:soul_lantern",
  "minecraft:sea_lantern",
  ...
]
```

Tried in order; the first block that exists in your game version is used.

!!! danger "It must break by hand"
    Whoever just died has no pickaxe — it is all inside the lantern. And
    `playerBreakBlock` only fires when the block would actually break, so with
    the wrong tool the event never arrives and the lantern becomes
    **permanently unrecoverable**. Crying obsidian looks the part and fails
    this test.

## Placement

The lantern goes to the nearest **safe** block, the way a bed finds a respawn
spot. Safe means all of it at once: the lantern fits, there is headroom, there
is solid ground to stand on, and no water or lava is touching it.

| Key | Default | Meaning |
|---|---|---|
| `searchRadius` | `6` | How far to look, in every direction |
| `requireStanding` | `true` | Demand solid ground below |
| `avoidLiquids` | `true` | Refuse spots inside or touching water and lava |
| `buildSupport` | `true` | Build a platform when nothing safe exists |
| `emergencySearchUp` | `320` | How far to climb when nothing safe exists |
| `light.enabled` | `false` | Extra light block above the lantern |

Search cost grows with the cube of `searchRadius`, but it is paid only by the
deaths that need it: most resolve at the death position or 1 block away.

`emergencySearchUp` covers the one case the search cannot solve — no safe block
anywhere near, in the void or deep underwater. The lantern then climbs straight
up until it leaves the liquid and stands on a platform. **A liquid position is
never accepted, at any stage.**

The extra light is off because a soul lantern already emits level 10. Turn it on
if you swap the marker for a block that does not glow.

## Collection

| Key | Default | Meaning |
|---|---|---|
| `pickupRadius` | `8` | Search radius for dropped items |
| `pickupDelayTicks` | `2` | Wait before the first collection |
| `sweepTicks` | `[10, 30, 60]` | Follow-up passes, feeding the same lantern |

Drops do not exist as entities the instant a player dies, so some wait is
unavoidable. Every tick of it is a window where the loot lies on the ground,
grabbable by someone else or burnable by the lava that did the killing — hence
2 ticks rather than 10.

That speed costs coverage: items are still flying outward and orbs still
spreading. The sweeps pick up what the first pass was too early to see.

## Experience

| Key | Default | Meaning |
|---|---|---|
| `mode` | `"full"` | `"full"` returns everything; `"vanilla"` only `min(level × 7, 100)` |
| `deliveryMode` | `"orbs"` | `"orbs"` spawns collectables; `"direct"` credits at once |
| `xpPerOrb` | `1` | Assumed value per orb |
| `maxOrbs` | `80` | Entity cap; the rest is credited directly |
| `orbRadius` | `16` | Radius for clearing the orbs dropped on death |

`orbRadius` is wider than `pickupRadius` on purpose: orbs scatter further than
items and keep drifting. **An orb left behind is experience received twice**,
since the same amount is already stored in the lantern.

!!! tip "Verify xpPerOrb in game"
    The API never exposes an orb's value, so this number is an assumption. Die
    with a known amount, recover it, and compare. If it is off, adjust here or
    switch to `"direct"` for exactness.

## Messages

| Key | Default | Meaning |
|---|---|---|
| `onLit` | `true` | One line on death, so the player knows a lantern exists |
| `onRecovery` | `false` | The full breakdown: items, gear, experience |
| `warnDropped` | `true` | Only when something did not fit |

Recovery narrates itself — the items are in the inventory, the armor is on the
body, the experience bar moved. `onRecovery` exists for anyone who wants the
numbers anyway.

## Protection

| Key | Default | Meaning |
|---|---|---|
| `ownerOnly` | `true` | Only the owner may break a lantern |
| `protection.explosions` | `true` | TNT, creepers, ghasts, beds |
| `protection.pistons` | `true` | Pistons cannot push the lantern away |
| `protection.support` | `true` | The block under the lantern counts as part of it |
| `protection.gravityBlocks` | gravel, sand… | Blocks that fall, and so may not serve as a base |
| `protection.gravitySuffixes` | `_concrete_powder`, `_anvil` | Families with one id per colour or damage level |
| `placement.stabiliseBase` | `true` | Replace a base that could fall with `supportBlock` |
| `repairTicks` | `100` | How often a missing marker is put back, in ticks. `0` disables |

## The guide

| Key | Default | Meaning |
|---|---|---|
| `itemIds` | `["minecraft:paper", ...]` | Item used, first available wins |
| `itemName` | `"§6Soul Guide"` | Item name — single language, see below |
| `refreshTicks` | `5` | Action bar update rate |
| `trail.enabled` | `true` | Particle trail toward the lantern |
| `trail.length` | `6` | Trail length in blocks |
| `beacon.visibleWithin` | `64` | Range at which the beam shows |
| `consumeOnRecover` | `true` | Map vanishes when no lanterns remain |

!!! note "The item name is not translated"
    `itemName` and the lore lines take plain strings; the API does not accept
    translation keys for item text. They read the same for every player,
    whatever their language. If your server is not English, set them here — it
    is the only text in the add-on that works that way.

## Sampling

| Key | Default | Meaning |
|---|---|---|
| `sampling.safetyNetTicks` | `100` | Backup snapshot interval, in ticks |
| `equipment.enabled` | `true` | Restore armor to its original slots |

Snapshots normally ride on damage events. This interval only covers deaths that
skip damage entirely. Lowering it costs performance for very little.

## Other

| Key | Default | Meaning |
|---|---|---|
| `vault.entityId` | `soulglass:vault` | The invisible storage entity |
| `warnAfterGraves` | `10` | Log a warning past this many unrecovered lanterns |

## The ground under a lantern is part of the lantern

A soul lantern needs something to stand on. Break that block and the lantern
pops off as an ordinary item — and nothing notices, because the break event
fires for the ground, not for the marker. The recovery that hands your
belongings back never runs, and the vault stays pinned underground with nothing
left to open it. Placing a soul lantern there by hand does not help: the
registry keys on a position, and what you placed is just a lantern.

So the two blocks behave as one:

- **You break either one** — the marker or the ground — and you get everything
  back, exactly as if you had aimed at the lantern. Neither block drops.
- **Anyone else breaks either one** and nothing happens, beyond a note telling
  them whose lantern it is. Otherwise a stranger with a shovel could end
  someone's recovery from below, where no protection was looking.
- **Explosions and pistons** skip both blocks, along with the light above them.

That leaves one kind of ground that is not really ground. Gravel and sand fall,
so a lantern standing on them is held up by the whole column beneath, and by
whatever holds that up. Breaking any link drops the lot: the lantern pops off
as an ordinary item, and the break event names the block that was hit,
somewhere else entirely, rather than the lantern.

Guarding every link would work and would be fragile. Instead the base simply
stops being able to fall — the add-on already builds ground over the void, and
this is the same problem wearing a disguise, so the same answer applies. When a
lantern is lit on gravel or sand, that one block becomes `supportBlock`.
Lanterns lit before this existed are converted in place by the repair sweep.

The cost is one block of the world changed, which is why `stabiliseBase` can be
turned off. Note that `minecraft:sandstone` and `minecraft:soul_sand` do not
fall despite their names, and are left alone — the match is on whole block ids
and suffixes, never on substrings.

Prevention only covers what announces itself as a player, an explosion or a
piston. Plain survival has other ways to remove a block, and none of them fire
an event naming the lantern: gravel or sand falling onto it, lava or water
reaching it, fire, or simply another add-on that has never heard of this one.

That is what `repairTicks` is for. Every few seconds each registered position
is checked, and a marker that is gone is put back, along with its ground. The
registry is what ties a place to its owner and their belongings, so the
registry wins.

The sweep never overwrites anything: a position occupied by something else is
left alone, and an unloaded chunk is skipped rather than treated as damage.

## `/kill @e` and the vault

The lantern is a block, so `/kill` never touches it. What the command reaches
is the invisible entity pinned beneath it, which is where the items live.

The vault refuses every kind of damage and cannot be pushed, burned or blown
up. `/kill` gets past all of that, because it does not deal damage — it removes
the entity, and no component setting prevents removal. Blocking the command was
never an option.

So the loss is undone instead of prevented. The contents are read while the
entity still exists, and a replacement vault is filled with them on the next
tick. `protection.rescueVault` controls this and is on by default.

| Option | Default | |
|---|---|---|
| `protection.rescueVault` | `true` | Rebuild the vault when its entity is removed |

Two things keep the cure from being worse than the disease. A rescue only
happens where the registry says a lantern stands, and only if no vault is
already there — two vaults for one lantern would duplicate every item in it.
And a chunk unloading also removes its entities, which is not a loss at all;
the marker block is unreadable while its chunk is gone, and that is how the two
cases are told apart.

Excluding the vault by family is still the better habit, because it never
relies on any of the above:

```
/kill @e[family=!soulglass_vault]
```

!!! warning "Untested in game"
    The rescue depends on `entityRemove` firing before the entity goes, with
    its inventory still readable. That is what the API documents; it has not
    been confirmed on 1.26 by running it. If it turns out not to hold, the
    fallback is the behaviour that shipped before: experience comes back, the
    items do not, and the owner is told.

## When the block wins the click

The menu opens on use, and a right-click reaches the add-on two ways: as
`itemUse` when it lands on air, and as an interaction when it lands on a block.
The second one arrives even when the block handled the click itself — opening a
chest does not use what is in your hand, but the game reports the interaction
regardless.

Left alone, that meant the menu appeared over every container, door and
workbench touched while carrying the guide. So the block gets first refusal.

| Option | Default | |
|---|---|---|
| `note.interactiveBlocks` | crafting table, lever, bell… | Blocks whose own action wins |
| `note.interactiveSuffixes` | `_door`, `_button`, `_bed`… | Families with one id per material |
| `note.openCooldown` | `10` | Ticks before the menu may open again |

Containers need no entry: they are recognised by their inventory component,
which covers chests, barrels, furnaces, hoppers and anything another add-on
introduces. The lists are for blocks that react while holding nothing — doors,
buttons, workstations, beds.

A soul lantern is excluded too. It answers a click with the hint saying to
break it, and that is its own action.

If some block still opens the menu when it should not, add its id to
`interactiveBlocks`, or its family to `interactiveSuffixes` — no code change.
