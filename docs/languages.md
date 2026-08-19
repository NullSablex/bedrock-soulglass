# Languages

Messages are sent as translation keys and resolved **by the client**, so every
player reads their own language. The server never needs to know anyone's locale
— which is just as well, because the API offers no way to ask.

Shipping with:

| File | Language |
|---|---|
| `en_US.lang` | English — the base |
| `pt_BR.lang` | Português (Brasil) |
| `es_ES.lang` | Español |

Any other language falls back to English, so no player ever sees a raw key.

## Adding a language

1. Copy `resource_packs/soulglass/texts/en_US.lang` to your language code, for
   example `fr_FR.lang`.
2. Translate the values. **Leave the keys untouched.**
3. Add the code to `resource_packs/soulglass/texts/languages.json`.
4. Run `python tools/check.py` — it fails if any key used by the code is
   missing from your file.

## Rules that matter

**Keep the `%s` placeholders**, in a position that makes sense for your
language. They are filled in order.

**Keep the `§` colour codes.** `§6` opens gold, `§7` grey, `§8` dark grey, `§a`
green, `§c` red, `§e` yellow, `§f` white.

**Stay inside Latin-1.** Accented letters are fine — `á`, `ç`, `ü`, `ñ` all
render normally. Characters above `U+00FF` — arrows, box drawing, emoji — force
Minecraft to redraw the **entire line** in a fallback font that clashes with the
rest of the interface. `tools/check.py` rejects those.

**Singular and plural are separate keys.** A `.lang` file has no plural rules,
so the code picks between `.one` and `.many`:

```
soulglass.blocks.one=1 block
soulglass.blocks.many=%s blocks
```

Languages with more than two plural forms need extra keys and a code change;
none of the shipped languages do.

## What cannot be translated

The map's **item name and lore**. Item text takes plain strings only, never
translation keys. They come from `config.js` and look the same to everyone.
