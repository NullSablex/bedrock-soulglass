# Architecture

This page records the API constraints that shaped the design. They cost real
time to discover, and several of them look like arbitrary choices until you know
what they are working around.

## Module layout

```
scripts/
  main.js        entry point, wiring only
  config.js      every tunable value

  tracker.js     samples player state before death
  xp.js          experience: sampling, orbs, crediting
  equip.js       equipment fingerprints and restoration

  grave.js       burial and recovery
  placement.js   finding a reachable spot; marker, support, light
  vault.js       the invisible storage entity
  storage.js     the persisted grave registry
  blocks.js      block predicates

  note.js        the map item
  guide.js       action bar, particle trail, chat listing
  distance.js    distance and ordering

  msg.js         translation helpers
  hud.js         action bar notices with repeat suppression
  safe.js        defensive event subscription
```

## The corpse is already empty

By the time `entityDie` fires, the inventory has been emptied and its contents
are item entities on the ground. Reading the dead player's inventory returns
nothing.

The add-on waits a few ticks and **collects the dropped entities** instead. Two
cases then come out right without special handling:

- `keepInventory` leaves nothing to collect, so no grave appears.
- Items destroyed by the death never existed as entities, so they never enter
  the grave, matching vanilla.

`keepInventory` is still checked explicitly, because it preserves **experience**
too. Without that check the add-on would bury XP the player never lost and hand
it back a second time.

## XP and equipment vanish before that

Same problem, same shape of answer: **sample before death**. The trigger is
`entityHurt` — to die you must take damage, so the snapshot is taken only when
it might matter, rather than twenty times a second for everyone standing still.

It cannot be purely event-driven: **there is no equipment-change event**.
Dragging a piece in the inventory screen emits nothing, because that screen
belongs to the client. A sparse safety net covers deaths that skip damage.

!!! warning "Ordering guard"
    `entityHurt` is an *after* event, so on the killing blow it may fire once
    the player is already stripped. A completely empty reading never overwrites
    a snapshot that had pieces in it, or the useful photo would be erased at the
    exact moment it is needed.

## Telling two identical helmets apart

If the player wore one diamond helmet and carried another, item type alone
cannot say which to put back on. Each piece gets a **fingerprint**: type, count,
name, durability, sorted enchantments and lore. Two pieces collide only when
they are identical in every respect, and then it does not matter which returns.

The fingerprint is computed **once, at death**. The snapshot stores the
`ItemStack` itself, which is already a copy; computing fingerprints while
sampling would put the expensive part in the hot path.

## The vault is an entity

`ItemStack` cannot be serialised without loss: written books, potions, shulker
contents, banner patterns and maps are not exposed for reading and writing.
Storing them as JSON hands back silently corrupted items. A real inventory never
converts anything.

An entity rather than a hidden container block buys two things:

- **41 slots**, exactly what a player carries (36 + 4 armor + 1 offhand), so one
  grave is always enough. A 27-slot barrel forced stacking three of them.
- **`private: true`**, which stops the inventory opening on interaction.
  Breaking the block becomes the only way in by the entity's own construction,
  not by cancelling an event.

The cost: `/kill @e` destroys it, which a block would have survived.

## The marker must break by hand

`playerBreakBlock` only fires when the block **would actually break**. With the
wrong tool the event never arrives at all.

Whoever just died has no pickaxe, because it is inside the grave. A marker that
needs one is unrecoverable forever. Crying obsidian was tried here and fails for
exactly this reason.

## An orb's value cannot be set

`spawnEntity("minecraft:xp_orb")` creates an orb, but the API never exposes what
it is worth. There is no way to create one orb worth 500.

The add-on spawns a *count* derived from `xpPerOrb`, in batches so the server
does not stall, and credits anything past the cap directly.

## Why paper, not a compass

A plain compass points at world spawn. A recovery compass only works in the
dimension where the death happened. Either way the needle is the most visible
part of the item and points somewhere other than the grave, so the player trusts
it and walks the wrong way.

Paper has no needle, so nothing competes with the action bar and the trail.

The sheet holds no data of its own; everything comes from the registry. That
keeps it current and stops a sheet that changes hands from leaking the previous
owner's coordinates.

## Translation lives in the resource pack

The **client** resolves translation keys, and clients never receive behavior
packs. So the strings ship in a resource pack, and the add-on cannot be
behavior-pack-only. Distribution is a single `.mcaddon` precisely so nobody ends
up with one half.

Two things stay in one language: item `nameTag` and `setLore` take plain strings
and reject `RawMessage`.

Translated fragments are also never glued together. Word order differs between
languages, so each full sentence is its own key — three short messages rather
than one assembled line.

## Fonts

A single character above `U+00FF` makes Minecraft redraw the **whole line** in a
fallback font that clashes with everything around it. Accented Latin-1 letters
are safe; arrows, box drawing and geometric symbols are not.

This is why headings read "ahead and right" instead of using arrow glyphs.

## Defensive subscription

The Script API changes between versions: an event present in 1.21 may be gone by
1.26. One bad subscription throws at load and takes the **whole add-on** down,
silently, with no checks running and nothing in the chat.

Every subscription goes through `subscribeSafe()`, so each failure is isolated
and names itself in the content log.

## The registry has no cap

A grave leaves the registry through exactly one path: its owner recovering it.

An earlier version pruned old records past a limit. That was a data-loss bug in
disguise: dropping the record does not remove the block from the world, it
abandons it — an ordinary lantern anyone can break, hiding a vault nobody can
reach.
