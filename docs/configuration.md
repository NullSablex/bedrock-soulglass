# Configuration

Everything lives in one file:
`behavior_packs/soulglass/scripts/config.js`. Edit it and restart the world.

## Grave marker

```js
markerBlocks: [
  "minecraft:soul_lantern",
  "minecraft:sea_lantern",
  ...
]
```

Tried in order; the first block that exists in your game version is used.

!!! danger "The marker must break by hand"
    Whoever just died has no pickaxe — it is all inside the grave. Choose a
    block that breaks without a tool, or the grave becomes **permanently
    unrecoverable**. Crying obsidian looks the part and fails this test.

## Placement

| Key | Default | Meaning |
|---|---|---|
| `searchUp` | `32` | How far up to look for a spot |
| `searchRadius` | `5` | How far sideways, if the death column will not do |
| `requireStanding` | `true` | Demand solid ground below |
| `avoidLiquids` | `true` | Refuse spots inside or touching water and lava |
| `buildSupport` | `true` | Build a platform when nothing else works |
| `light.enabled` | `false` | Extra light block above the grave |

The light is off because the soul lantern already emits level 10. Turn it on if
you swap the marker for a block that does not glow.

## Experience

| Key | Default | Meaning |
|---|---|---|
| `mode` | `"full"` | `"full"` returns everything; `"vanilla"` only `min(level × 7, 100)` |
| `deliveryMode` | `"orbs"` | `"orbs"` spawns collectables; `"direct"` credits at once |
| `xpPerOrb` | `1` | Assumed value per orb |
| `maxOrbs` | `80` | Entity cap; the rest is credited directly |

!!! tip "Verify xpPerOrb in game"
    The API never exposes an orb's value, so this number is an assumption. Die
    with a known amount, recover it, and compare. If it is off, adjust here or
    switch to `"direct"` for exactness.

## Protection

| Key | Default | Meaning |
|---|---|---|
| `ownerOnly` | `true` | Only the owner may break a grave |
| `protection.explosions` | `true` | TNT, creepers, ghasts, beds |
| `protection.pistons` | `true` | Pistons cannot push the marker away |

## The map

| Key | Default | Meaning |
|---|---|---|
| `itemIds` | `["minecraft:paper", ...]` | Item used, first available wins |
| `itemName` | `"§6Grave Map"` | Item name — single language, see below |
| `refreshTicks` | `5` | Action bar update rate |
| `trail.enabled` | `true` | Particle trail toward the grave |
| `trail.length` | `6` | Trail length in blocks |
| `beacon.visibleWithin` | `64` | Range at which the beam shows |
| `consumeOnRecover` | `true` | Map vanishes when no graves remain |

!!! note "Item text is not translated"
    `itemName` and the lore lines take plain strings; the API does not accept
    translation keys for item text. They appear the same to every player.

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
| `pickupRadius` | `8` | Search radius for dropped items |
| `pickupDelayTicks` | `10` | Wait after death before collecting |
| `warnAfterGraves` | `10` | Log a warning past this many unrecovered graves |
