export const CONFIG = {
  /**
   * The visible lantern block. Tried in order: the first one that exists in this
   * game version wins. Without a resource pack there is no custom texture, so
   * the choice is among vanilla blocks.
   *
   * Three requirements, and the third is non-negotiable:
   *
   * 1. NOT A CONTAINER — a lantern you can open is not a lantern.
   *
   * 2. It emits light. Light emission is a property of the block TYPE, declared
   *    in its definition; a script cannot change it. A block that already glows
   *    saves us from hanging a separate light source next to the lantern.
   *
   * 3. BREAKABLE BY HAND, without a tool. Someone who just died owns no
   *    pickaxe — it is all inside the lantern. And `playerBreakBlock` only fires
   *    when the block would actually break: with the wrong tool the event never
   *    arrives and the lantern is unrecoverable forever. Crying obsidian was
   *    tried here and fails for exactly that reason: it needs a diamond pickaxe.
   */
  markerBlocks: [
    // Soul lantern: blue soul flame over the lantern, light level 10, and it
    // breaks instantly by hand.
    "minecraft:soul_lantern",
    "minecraft:sea_lantern",
    "minecraft:glowstone",
    "minecraft:shroomlight",
    // No glow, in case none of the above exists in this version.
    "minecraft:chiseled_stone_bricks",
    "minecraft:cobblestone",
  ],

  /**
   * The vault is an invisible ENTITY bound to the lantern, not a hidden block.
   *
   * Two reasons. First, its inventory holds exactly what a player carries — 36
   * inventory slots + 4 armor + 1 offhand — so one lantern is always enough; a
   * 27-slot barrel forced us to stack three of them. Second, `private: true`
   * keeps the inventory from opening on any interaction: breaking the lantern
   * becomes the only way in by the entity's own construction, not by cancelling
   * an event.
   *
   * The definition lives in entities/vault.json. With no client-side model the
   * entity renders as nothing, which is exactly what we want.
   *
   * The slot count is NOT configurable from here: it is declared as
   * `inventory_size` in that file, and the game reads it from there. A number
   * in this file would be editable and have no effect, which is worse than no
   * number at all. The code asks the container for its own size.
   */
  vault: {
    entityId: "soulglass:vault",
  },

  /**
   * The menu the guide opens, and the only place an author can be named.
   *
   * Bedrock gives an add-on nowhere to put credits: no about screen, a pack
   * description nobody opens, and item names that are plain strings shared by
   * every language. A form is the one surface in the game where this can be
   * read.
   */
  menu: {
    enabled: true,

    /**
     * Button icons, as texture paths.
     *
     * Vanilla paths on purpose: the add-on ships no art, and a path that comes
     * with the game needs no resource pack of its own. A path the game does
     * not have renders as a blank square rather than failing, so a wrong guess
     * costs an icon and nothing else — which is also why these are here to be
     * corrected rather than buried in the code.
     *
     * Set any of them to undefined for a button with no icon.
     */
    icons: {
      lanterns: "textures/blocks/soul_lantern",
      chat: "textures/ui/chat_send",
      credits: "textures/ui/infobulb",
      link: "textures/ui/copy",
      back: "textures/ui/arrow_left",
    },
    /**
     * A form refuses to open while the player is holding a key, and reports it
     * as a cancellation rather than an error. Sneaking is the gesture that
     * asks for the menu, so that state is the norm rather than the exception:
     * it waits for the key to come up instead of failing silently.
     */
    retries: 10,
    retryTicks: 5,
  },

  /**
   * Shown on the credits screen. Plain values, not translation keys: a name is
   * a name in every language, and a version number is a version number.
   */
  credits: {
    name: "Soulglass",
    author: "NullSablex",
    version: "1.0.0",
    license: "MPL-2.0",
    /**
     * Two forms of the same address, because two surfaces have two widths.
     *
     * A form body wraps mid-word and inserts a hyphen doing it, which turned
     * "bedrock-soulglass" into "bedrock-soulg-lass" on screen — an address
     * that reads as real and is not. `repo` fits the width, so it never wraps.
     * Chat is wider and can be copied from, so it gets the whole thing.
     */
    repo: "NullSablex/bedrock-soulglass",
    url: "https://github.com/NullSablex/bedrock-soulglass",
  },

  /**
   * The soul guide, handed over on respawn.
   *
   * It is a sheet of paper rather than a compass, and the reason is the needle:
   * on a plain compass it points at world spawn, and on a recovery compass it
   * only works in the dimension where the death happened. Either way the needle
   * is the most visible part of the item and points somewhere other than where
   * the addon means to send you — the player trusts it and walks the wrong way.
   *
   * Paper has no needle. All the guidance comes from the action bar, the
   * particle trail, and the coordinates written on the sheet itself.
   *
   * Identification is by NAME, not by type: ordinary paper stays ordinary.
   *
   * The item name and lore cannot be translated per player — item text takes
   * plain strings only, never RawMessage. They use the language set here.
   */
  note: {
    enabled: true,

    /** Tried in order: the first one that exists in this version wins. */
    itemIds: [
      "minecraft:paper",
      "minecraft:book",
    ],
    itemName: "§bSoul Guide",
    loreHeader: "§7Scrawled in a hurry.",
    loreFooter: "§7Hold it to find your soul lantern",
    loreBlank: "§8A blank sheet.",

    /** Ticks between action bar refreshes. 5 means four times per second. */
    refreshTicks: 5,

    /**
     * Particle trail pointing at the lantern.
     *
     * This is what the needle should have done and could not. It also improves
     * on a needle, because it points in three dimensions instead of only on the
     * horizontal plane.
     */
    trail: {
      enabled: true,
      particle: "minecraft:endrod",
      /** Trail length, one point per block ahead. */
      length: 6,
      /** Ticks between one trail and the next. */
      everyTicks: 10,
    },

    /** Particle beam rising from the lantern, visible within this range. */
    beacon: {
      enabled: true,
      particle: "minecraft:endrod",
      height: 8,
      visibleWithin: 64,
    },

    /** Disappears from the inventory once no lantern is left to point at. */
    consumeOnRecover: true,
  },

  /**
   * How much the add-on says in chat.
   *
   * Almost nothing, by default. Recovering a lantern already shows itself: the
   * items are in the inventory, the armor is on the body, the experience bar
   * moved. Narrating all of that is noise, and six lines for one event reads
   * worse than silence.
   *
   * What survives is only what the player cannot see for themselves — that a
   * lantern now exists somewhere, and that something did not fit and is lying on
   * the ground about to despawn.
   */
  messages: {
    /** One line on death, so the player knows a lantern was created. */
    onLit: true,
    /** The full breakdown on recovery: items, gear, experience. */
    onRecovery: false,
    /** Only when something did not fit. This one is actionable. */
    warnDropped: true,
  },

  /** Search radius for the item entities dropped on death. */
  pickupRadius: 8,

  /**
   * Ticks to wait after death before the first collection.
   *
   * Drops do not exist as entities the instant `entityDie` fires, so some wait
   * is unavoidable. Every tick of it is a window where the loot lies on the
   * ground in plain sight, able to be grabbed by someone else or burned by the
   * lava that did the killing. Two ticks is enough for the entities to appear.
   */
  pickupDelayTicks: 2,

  /**
   * Follow-up sweeps, in ticks after death.
   *
   * The first pass is deliberately early, which means it can miss items still
   * flying outward and experience orbs still spreading. These later passes top
   * up the same lantern rather than making a new one.
   *
   * Missing an orb is not cosmetic: the experience is already stored in the
   * lantern, so anything left on the ground is duplicated experience.
   */
  sweepTicks: [10, 30, 60],

  /** Only the owner breaks the lantern and receives its contents. */
  ownerOnly: true,

  /**
   * There is no cap on lanterns per player — dying again before recovering the
   * previous one creates another, and all of them stay valid.
   *
   * A cap would be worse than the disease: dropping a record does not remove
   * the block from the world, it only abandons it with the items inside. A
   * lantern leaves the registry through one path only, its owner recovering it.
   *
   * This number is merely when to warn in the log that someone is piling up.
   */
  warnAfterLanterns: 10,

  /**
   * When the player's state (XP and equipment) gets photographed.
   *
   * The main trigger is `entityHurt`: to die, a player has to take damage, so
   * the sample is taken only when it might matter. There is no equipment-change
   * event in the API — dragging a piece in the inventory screen emits nothing —
   * so the safety net below covers a death that somehow skips damage.
   * 100 ticks is 5 seconds. Zero disables the net.
   */
  sampling: {
    safetyNetTicks: 100,
  },

  /**
   * Armor and offhand go back to their original slots on recovery, already
   * worn — and it is the exact piece that was on the body, not another
   * identical one that happened to be in the backpack.
   */
  equipment: {
    enabled: true,
  },

  /** Experience stored with the items, returned when the lantern is broken. */
  xp: {
    enabled: true,
    /**
     * "full"    - returns ALL the experience the player had on death.
     * "vanilla" - returns only what vanilla would drop: min(level * 7, 100).
     */
    mode: "full",
    /**
     * "orbs"   - spawns minecraft:xp_orb entities for the player to collect.
     * "direct" - credits the exact amount at once, with the pickup sound.
     */
    deliveryMode: "orbs",
    /** Assumed value of each orb spawned through the API. */
    xpPerOrb: 1,
    /** Entity cap per lantern — without it 2000 xp would become lag. */
    maxOrbs: 80,
    /** Ticks between each batch of orbs, to spread the cost. */
    orbBatchDelay: 2,

    /**
     * Search radius when clearing the orbs that dropped on death.
     *
     * Wider than pickupRadius on purpose: orbs scatter further than items and
     * keep drifting. An orb left behind is experience the player receives
     * twice, since the same amount is already stored in the lantern.
     */
    orbRadius: 16,
  },

  /**
   * The lantern is indestructible by anything other than its owner breaking it.
   * Each key here closes a different destruction vector.
   */
  protection: {
    /** TNT, creepers, ghasts, beds in the Nether, respawn anchors in the End. */
    explosions: true,
    /** A piston shoving the marker out of place. */
    pistons: true,
    /**
     * The block the marker rests on counts as part of the lantern.
     *
     * A soul lantern needs support. Knock the block out from under it and the
     * lantern pops off as an ordinary item — and `playerBreakBlock` fires for
     * the ground, not for the marker, so nothing notices, and the vault stays
     * pinned underground with no way left to open it.
     *
     * With this on, the ground behaves exactly like the marker: the owner
     * breaking it gets their belongings back, anyone else is stopped, and
     * explosions and pistons leave it alone. Turning it off restores the hole
     * described above; there is no good reason to.
     */
    support: true,

    /**
     * Put the vault back when something removes the entity.
     *
     * `/kill @e` is the case that matters. The vault refuses all damage, but
     * `/kill` does not deal damage — it removes the entity, and no component
     * setting prevents that. The command is usually typed to clear dropped
     * items or mobs, and emptying somebody's lantern is collateral the person
     * typing it never intended.
     *
     * So the loss is undone rather than prevented: the contents are read while
     * the entity still exists, and a replacement vault is filled with them on
     * the next tick.
     */
    rescueVault: true,

    /**
     * Blocks that fall when what holds them up is removed.
     *
     * A lantern standing on gravel is held up by whatever is under the gravel,
     * and by whatever is under that. Breaking any link drops the whole column
     * and the lantern with it, and the break event names the block that was
     * hit — never the lantern. So a base on this list is replaced rather than
     * guarded: see `placement.stabiliseBase`.
     */
    gravityBlocks: [
      "minecraft:gravel",
      "minecraft:suspicious_gravel",
      "minecraft:sand",
      "minecraft:red_sand",
      "minecraft:suspicious_sand",
      "minecraft:concrete_powder",
      "minecraft:anvil",
      "minecraft:pointed_dripstone",
      "minecraft:dragon_egg",
    ],

    /**
     * Families where the game has one block id per colour or per damage level.
     *
     * Matched by suffix, because listing every one by hand would go stale the
     * moment a version adds another. Kept as suffixes rather than substrings on
     * purpose: `sandstone` contains `sand` and does not fall.
     */
    gravitySuffixes: ["_concrete_powder", "_anvil"],

  },

  /**
   * How often to check that every marker is still standing, in ticks.
   *
   * Prevention closes what announces itself: a player, an explosion, a piston.
   * This closes the rest, and the rest is ordinary survival — gravel falling
   * onto the lantern, fire, lava reaching it, another addon that has never
   * heard of this one. The registry is authoritative: if it says a lantern is
   * there, the block goes back. 0 disables the sweep.
   *
   * Cost is one block read per lantern per pass, skipping unloaded chunks.
   */
  repairTicks: 100,

  /**
   * Where a lantern may appear.
   *
   * Finding empty space is not enough: dying in lava or at the bottom of the
   * sea would put the lantern inside the liquid, and the owner would have to die
   * again to recover their own belongings. The spot has to be REACHABLE —
   * solid ground to stand on, headroom, and no liquid touching it.
   */
  placement: {
    /**
     * How far to look for a safe block, in every direction.
     *
     * The lantern goes to the nearest safe block from where the player died, the
     * way a bed finds a respawn spot. Search cost grows with the cube of this
     * number, but it is paid only by deaths that need it: most resolve at the
     * death position or one block away.
     */
    searchRadius: 6,

    /**
     * Vertical range for the one case the search cannot solve: no safe block
     * anywhere near, in the void or deep underwater. Much larger than the
     * radius because the job is to climb out of a liquid, and an ocean floor
     * can sit a hundred blocks below the surface.
     */
    emergencySearchUp: 320,
    /** Require solid ground below, so the owner can stand there. */
    requireStanding: true,
    /** Reject spots inside or touching water and lava. */
    avoidLiquids: true,
    /**
     * Last resort: when nothing works (death in the void, mid-ocean), place a
     * support block under the lantern. An improvised platform beats an
     * unreachable lantern.
     */
    buildSupport: true,
    supportBlock: "minecraft:cobblestone",

    /**
     * Replace a base that can fall with `supportBlock`.
     *
     * Building ground over the void is already accepted, and this is the same
     * problem wearing a disguise: gravel and sand look like ground until
     * something under them is removed, and then the lantern falls with the
     * column. One block of the world changes so the lantern cannot be dropped
     * by digging somewhere else entirely.
     */
    stabiliseBase: true,

    /**
     * EXTRA light source, one block above the lantern.
     *
     * Off by default because the marker already glows on its own: a soul
     * lantern emits light level 10, enough to find the lantern in the dark. Turn
     * it on for the wider reach of level 15, or if you swap the marker for a
     * block that emits nothing.
     *
     * The cost of turning it on: one more block to create, protect from
     * explosions and clean up afterwards. A block that takes care of itself is
     * worth more than two.
     */
    light: {
      enabled: false,
      block: "minecraft:light_block",
      level: 15,
    },
  },

  /**
   * Blocks a lantern may replace. Liquids are deliberately absent — see
   * `placement.avoidLiquids`.
   */
  replaceable: [
    "minecraft:air",
    "minecraft:tallgrass",
    "minecraft:short_grass",
    "minecraft:fern",
    "minecraft:snow_layer",
    "minecraft:vine",
  ],

  /** Minimum safe height per dimension, for deaths in the void. */
  minY: {
    "minecraft:overworld": -60,
    "minecraft:nether": 5,
    "minecraft:the_end": 5,
  },
};
