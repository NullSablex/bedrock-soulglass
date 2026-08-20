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

  lantern.js     lighting and recovery
  placement.js   finding a reachable spot; marker, support, light
  vault.js       the invisible storage entity
  storage.js     the persisted lantern registry
  blocks.js      block predicates

  note.js        the guide item
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

- `keepInventory` leaves nothing to collect, so no lantern appears.
- Items destroyed by the death never existed as entities, so they never enter
  the lantern, matching vanilla.

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
  lantern is always enough. A 27-slot barrel forced stacking three of them.
- **`private: true`**, which stops the inventory opening on interaction.
  Breaking the block becomes the only way in by the entity's own construction,
  not by cancelling an event.

The cost: `/kill @e` destroys it, which a block would have survived.

## Nearest safe block, with no exceptions

The lantern goes to the nearest **safe** block from where the player died, in
3 dimensions, the way a bed finds a respawn spot. Safe is one definition
applied everywhere: the lantern fits, there is headroom, there is solid ground
below, and no liquid touches the spot.

This replaced 3 passes with differing standards, and the replacement was not
cosmetic. The last of those passes accepted a liquid position as a desperate
measure, so dying at the bottom of the ocean produced a lantern inside the
water — the exact case the careful checks existed to prevent. **A rule that is
softened in the branch that runs when things go wrong is not a rule.**

The old search was also not doing what its name claimed: it walked horizontal
rings but scanned each column from the bottom up, returning the first spot in
an arbitrary order rather than the closest one.

One case survives that the search cannot solve: no safe block anywhere near, in
the void or deep underwater. The lantern then climbs the death column until it
leaves the liquid and stands on a platform built for it. Even there, the
position itself is never liquid.

## Only the current dimension is listed

The chat listing shows lanterns in the dimension the player is standing in, and
nothing else. Coordinates from another world are not merely unreachable without
a portal — they name a different place in the world the player is in, so
showing them invites walking to the wrong spot.

The empty case still needs a voice. A player whose only lantern is in the
Nether would otherwise read you have none and conclude the loot was lost, so
that case reports a count instead.

This replaced a version that grouped every lantern under dimension headings.
Grouping answered the ambiguity but kept the noise: information the player
could not act on, listed under a heading explaining why they could not act on
it.
## Collection is a race against visibility

Drops do not exist as entities the instant `entityDie` fires, so the first
collection has to wait. Every tick of that wait is a window where the loot lies
on the ground, grabbable by another player and burnable by the lava that did
the killing — which is why the wait is 2 ticks rather than 10.

Speed costs coverage: items are still flying outward, orbs still spreading.
Follow-up sweeps at 10, 30 and 60 ticks top up the same lantern.

The orbs matter more than the items. Their value is already stored in the
lantern, so **an orb left on the ground is experience received twice** —
duplication, which this project treats as its most severe class of bug. They
are cleared with a wider radius than items for the same reason: they scatter
further and keep drifting.

## The registry outranks the world

A marker can disappear without any event naming it. Breaking the block under a
soul lantern pops it off as an item, and `playerBreakBlock` fires for the
ground, not for the marker — so the handler watching the marker's position
never sees anything. The record survives, the vault survives, and the only
thing tying them to a player is a block that is now lying on the floor as loot.
Re-placing a lantern there does not restore anything: the registry keys on a
position, and the block carries no identity.

That is one vector out of an open set, and the set is not made of commands.
Gravel falling onto a lantern removes it. So does fire, or lava finding it, or
another add-on rewriting the block. None of these fire an event that names the
lantern, and there is no event to subscribe to that would let a script refuse
them.

The fix treats both positions as one lantern rather than adding a second rule for
the ground, and makes the ground worth treating that way: a base that can fall
is replaced when the grave is created. Gravel and sand look like ground until
something under them is removed, and a lantern on a gravel column is one dig
away from dropping — a dig that can be anywhere down that column, reported as a
break of a block that has nothing to do with any lantern. Following the column
upward on every break would close it too, but the guarantee is cheaper than the
search, and it removes the case instead of detecting it. Breaking either block resolves to the same record, so the owner
gets their belongings back whichever one they hit, and a stranger is stopped at
both — the alternative left an obvious way to end someone else's recovery by
digging under it, where nothing was watching. Neither block drops, because the
script performs the handover.

Prevention is still only the part that can be aimed. A periodic sweep handles
the rest by treating the registry as authoritative: if a record says a marker
stands at a position, the block goes back there.

The sweep is deliberately timid. It skips a position holding anything solid,
because overwriting what a player built would trade one loss for another, and
it skips unloaded chunks — a lantern nobody has visited is absent, not damaged.

## The marker must break by hand

`playerBreakBlock` only fires when the block **would actually break**. With the
wrong tool the event never arrives at all.

Whoever just died has no pickaxe, because it is inside the lantern. A marker that
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
part of the item and points somewhere other than the lantern, so the player trusts
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

A lantern leaves the registry through exactly one path: its owner recovering it.

An earlier version pruned old records past a limit. That was a data-loss bug in
disguise: dropping the record does not remove the block from the world, it
abandons it — an ordinary lantern anyone can break, hiding a vault nobody can
reach.
