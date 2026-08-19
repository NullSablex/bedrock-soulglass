export const CONFIG = {
  /**
   * The visible grave block. Tried in order: the first one that exists in this
   * game version wins. Without a resource pack there is no custom texture, so
   * the choice is among vanilla blocks.
   *
   * Three requirements, and the third is non-negotiable:
   *
   * 1. NOT A CONTAINER — a grave you can open is not a grave.
   *
   * 2. It emits light. Light emission is a property of the block TYPE, declared
   *    in its definition; a script cannot change it. A block that already glows
   *    saves us from hanging a separate light source next to the grave.
   *
   * 3. BREAKABLE BY HAND, without a tool. Someone who just died owns no
   *    pickaxe — it is all inside the grave. And `playerBreakBlock` only fires
   *    when the block would actually break: with the wrong tool the event never
   *    arrives and the grave is unrecoverable forever. Crying obsidian was
   *    tried here and fails for exactly that reason: it needs a diamond pickaxe.
   */
  markerBlocks: [
    // Soul lantern: blue soul flame over the grave, light level 10, and it
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
   * The vault is an invisible ENTITY bound to the grave, not a hidden block.
   *
   * Two reasons. First, its inventory holds exactly what a player carries — 36
   * inventory slots + 4 armor + 1 offhand — so one grave is always enough; a
   * 27-slot barrel forced us to stack three of them. Second, `private: true`
   * keeps the inventory from opening on any interaction: breaking the grave
   * becomes the only way in by the entity's own construction, not by cancelling
   * an event.
   *
   * The definition lives in entities/vault.json. With no client-side model the
   * entity renders as nothing, which is exactly what we want.
   */
  vault: {
    entityId: "soulglass:vault",
    slots: 41,
  },

  /**
   * The grave map, handed over on respawn.
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
    itemName: "§6Grave Map",
    loreHeader: "§7Scribbled in a hurry.",
    loreFooter: "§7Hold it to see the way",
    loreBlank: "§8A blank sheet.",

    /** Ticks between action bar refreshes. 5 means four times per second. */
    refreshTicks: 5,

    /**
     * Particle trail pointing at the grave.
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

    /** Particle beam rising from the grave, visible within this range. */
    beacon: {
      enabled: true,
      particle: "minecraft:endrod",
      height: 8,
      visibleWithin: 64,
    },

    /** Disappears from the inventory once no grave is left to point at. */
    consumeOnRecover: true,
  },

  /** Search radius for the item entities dropped on death. */
  pickupRadius: 8,
  /** Ticks to wait after death for the drops to exist as entities. */
  pickupDelayTicks: 10,

  /** Only the owner breaks the grave and receives its contents. */
  ownerOnly: true,

  /**
   * There is no cap on graves per player — dying again before recovering the
   * previous one creates another, and all of them stay valid.
   *
   * A cap would be worse than the disease: dropping a record does not remove
   * the block from the world, it only abandons it with the items inside. A
   * grave leaves the registry through one path only, its owner recovering it.
   *
   * This number is merely when to warn in the log that someone is piling up.
   */
  warnAfterGraves: 10,

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

  /** Experience stored with the items, returned when the grave is broken. */
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
    /** Entity cap per grave — without it 2000 xp would become lag. */
    maxOrbs: 80,
    /** Ticks between each batch of orbs, to spread the cost. */
    orbBatchDelay: 2,
  },

  /**
   * The grave is indestructible by anything other than its owner breaking it.
   * Each key here closes a different destruction vector.
   */
  protection: {
    /** TNT, creepers, ghasts, beds in the Nether, respawn anchors in the End. */
    explosions: true,
    /** A piston shoving the marker out of place. */
    pistons: true,
  },

  /**
   * Where a grave may appear.
   *
   * Finding empty space is not enough: dying in lava or at the bottom of the
   * sea would put the grave inside the liquid, and the owner would have to die
   * again to recover their own belongings. The spot has to be REACHABLE —
   * solid ground to stand on, headroom, and no liquid touching it.
   */
  placement: {
    /** How far up to search for a good spot, starting from the death point. */
    searchUp: 32,
    /** Horizontal search radius, when the death column will not do. */
    searchRadius: 5,
    /** Require solid ground below, so the owner can stand there. */
    requireStanding: true,
    /** Reject spots inside or touching water and lava. */
    avoidLiquids: true,
    /**
     * Last resort: when nothing works (death in the void, mid-ocean), place a
     * support block under the grave. An improvised platform beats an
     * unreachable grave.
     */
    buildSupport: true,
    supportBlock: "minecraft:cobblestone",

    /**
     * EXTRA light source, one block above the grave.
     *
     * Off by default because the marker already glows on its own: a soul
     * lantern emits light level 10, enough to find the grave in the dark. Turn
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
   * Blocks a grave may replace. Liquids are deliberately absent — see
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
