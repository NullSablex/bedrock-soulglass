# Languages

Messages are sent as translation keys and resolved **by the client**, so every
player reads their own language. The server never needs to know anyone's locale
— which is just as well, because the API offers no way to ask.

## Shipping with

| File | Language |
|---|---|
| `en_US.lang` | English — the base |
| `pt_BR.lang` | Português (Brasil) |
| `pt_PT.lang` | Português (Portugal) |
| `es_ES.lang` | Español (España) |
| `es_MX.lang` | Español (México) |
| `de_DE.lang` | Deutsch |
| `fr_FR.lang` | Français |
| `it_IT.lang` | Italiano |
| `ru_RU.lang` | Русский |
| `zh_CN.lang` | 简体中文 |
| `ja_JP.lang` | 日本語 |

Any other language falls back to English, so no player ever sees a raw key.

!!! note "Regional variants are not shared"
    The game does not fall back from `pt_PT` to `pt_BR`, or from `es_MX` to
    `es_ES` — it goes straight to English. That is why both variants exist as
    separate files even though much of the text overlaps.

!!! warning "These translations want native review"
    Only English and Portuguese were written by someone who speaks them.
    The rest are a starting point: correct in meaning, but a native speaker
    will spot phrasing that reads like a translation. Corrections are welcome,
    and a single fixed line is a worthwhile pull request.

## Adding a language

1. Copy `resource_packs/soulglass/texts/en_US.lang` to your language code, for
   example `nl_NL.lang`.
2. Translate the values. **Leave the keys untouched.**
3. Add the code to `resource_packs/soulglass/texts/languages.json`.
4. Run `python tools/check.py` — it fails if any key used by the code is
   missing from your file.

## Rules that matter

**Keep the `%s` placeholders**, in a position that makes sense for your
language. They are filled in order.

**Keep the `§` colour codes.** `§6` opens gold, `§7` grey, `§8` dark grey, `§a`
green, `§c` red, `§e` yellow, `§f` white.

**Singular and plural are separate keys.** A `.lang` file has no plural rules,
so the code picks between `.one` and `.many`:

```
soulglass.blocks.one=1 block
soulglass.blocks.many=%s blocks
```

Languages with more than 2 plural forms need extra keys and a code change; none
of the shipped languages do.

**Whole sentences, never fragments.** Each key is a complete sentence on
purpose. Word order differs between languages, so gluing translated pieces
together produces something that reads correctly in English and nowhere else.

### About scripts and symbols

Write your language in its own script. Cyrillic, Chinese and Japanese all
render properly, as `ru_RU`, `zh_CN` and `ja_JP` show.

What to avoid is **decorative symbols** — arrows, box drawing, geometric
shapes. A single one of those forces Minecraft to redraw the entire line in a
fallback font that clashes with the rest of the interface. That is why headings
read "ahead and right" instead of using an arrow glyph. Accented letters are
never a problem.

## Translating this documentation

Separate from the in-game text, and a separate decision. The site runs
`mkdocs-static-i18n` with a suffix layout:

```
docs/index.md          English, the default
docs/index.pt-BR.md    the same page in Brazilian Portuguese
```

A page with no translation **falls back to English** instead of 404ing, so a
language can be added one page at a time rather than all at once. Start with
`index.md` and `features.md` — those are what a player reads before deciding to
install anything.

To add a language, add its locale to the `i18n` plugin in `mkdocs.yml`,
including the `nav_translations` block so the sidebar is translated too.

!!! note "Fewer languages here than in game, on purpose"
    The `.lang` files are 40 keys a contributor can finish in one sitting and
    never revisit. A documentation page is prose that goes stale every time the
    add-on changes. Adding a locale here is a standing commitment, not a
    one-off, which is why the site ships fewer languages than the game text
    does.

## What cannot be translated

The guide's **item name and lore**. Item text takes plain strings only, never
translation keys, so they read the same for every player. They come from
`config.js`, and a server running in one language should set them there.
