# What it does

Soulglass changes one thing: what happens when you die.

Vanilla scatters everything you carried on the ground, starts a five-minute
timer, and throws your experience away as orbs that expire. Get back in time or
lose it. Die in lava and there was never anything to get back.

With Soulglass, the ground stays clean. Everything you had goes into a **soul
lantern**, lit at the exact place you died, and you are handed a guide pointing
at it. Break the lantern and it all comes back — armor already on your body.

<!-- ![A soul lantern at a death site](img/lantern.png) -->

## Nothing is lost, including experience

Items and experience travel together. That second part is what most death
add-ons leave out: they store your inventory and let the orbs expire anyway, so
you walk back to find your gear intact and thirty levels gone.

The lantern holds both. By default you get back **everything** you had, not
just the fraction vanilla would have dropped.

## Armor comes back worn

Not "in your inventory" — **on your body**, in the slots it came from. Helmet,
chestplate, leggings, boots and offhand.

And it is the piece you were actually wearing. If you carried two diamond
helmets, the one that goes back on your head is the one that was on your head,
with its own damage and its own enchantments. They are told apart by type,
durability, enchantments, name and lore, so the spare stays a spare.

<!-- ![Armor restored to the body](img/recovery.png) -->

## A guide that actually points

You respawn holding a sheet of paper. While you hold it:

- The action bar shows **how far**, **which way** and **how much up or down** —
  relative to where you are looking, so "ahead and right" means ahead and right.
- A trail of particles runs through the air along the real line to the lantern,
  rising and falling with the terrain. An arrow tells you a direction on the
  flat; this tells you to climb.
- Within 64 blocks a beam marks the lantern itself.

<!-- ![The guide on the action bar](img/guide-hud.png) -->
<!-- ![The particle trail](img/guide-trail.png) -->

**Sneak while holding it** and your lanterns are listed in chat with their
coordinates and distance. Only the world you are standing in is listed —
coordinates from the Nether mean a different place in the Overworld, so showing
them would send you to the wrong spot. If everything you have is somewhere
else, it says so rather than telling you that you have none.

<!-- ![The chat listing](img/list.png) -->

The guide disappears on its own once you have collected everything.

## It is yours, and nothing can take it

A lantern is tied to the player who died there.

- **Other players cannot open it or break it.** They get a note saying whose it
  is, and nothing moves.
- **Explosions leave it alone.** TNT still goes off and still wrecks the
  terrain around it; the lantern and the block under it are simply not on the
  list of what the blast may touch.
- **Pistons cannot shove it** away from the belongings pinned underneath.
- **The block holding it up counts as part of it.** A lantern needs support, so
  breaking the ground would knock it loose — for you that returns your things
  as if you had broken the lantern itself, and for anyone else it does nothing
  at all.
- **It never expires.** Die again before recovering and you simply have two.
  There is no timer, and nothing is overwritten.

<!-- ![Another player blocked](img/protected.png) -->

## Placed somewhere you can actually reach

Dying in a bad place is normal, and a lantern you cannot reach is the same as
losing everything.

So the lantern is not left where you fell. It goes to the **nearest safe
block**, the way a bed looks for somewhere to put you: solid ground under it,
headroom to swing at it, and no liquid touching it.

- **Died in lava or underwater?** The lantern is on dry land nearby, not inside
  the liquid.
- **Died in the void, or over the ocean?** A block is built to stand it on,
  rather than leaving it somewhere nobody can get to.
- **Died on sand or gravel?** Those fall. A solid block goes underneath, so
  nobody drops your lantern by digging somewhere else entirely.

<!-- ![A stabilised base](img/stabilised.png) -->

Works in the Overworld, the Nether and the End alike.

## Everyone reads their own language

Messages are sent as keys and resolved by each player's own game. Two players
standing side by side see the same message, each in their own language — the
server does not need to know or care which. 11 ship today; anything else falls
back to English.

## What it does not do

Worth knowing before you install it, because no add-on should be sold on
silence:

- **It does nothing when `keepInventory` is on.** That rule already keeps your
  experience too, so a lantern would be handing back what you never lost.
- **It does not restore your inventory layout**, only your equipment slots.
  Items come back in the order they were stored.
- **`/kill @e` destroys the storage** along with every other entity in the
  world. Your experience still comes back and you are told what happened, but
  the items are gone. Run that command knowing what it does.
- **The guide's item name is not translated.** Item text cannot carry
  translation keys, so it reads the same for everyone; a server can set it to
  its own language.

## Try it

- [Installation](installation.md) — two packs, both required
- [Using the guide](guide.md) — the guide in detail
- [Configuration](configuration.md) — for server owners
