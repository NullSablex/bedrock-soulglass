#!/usr/bin/env python3
"""
Static checks for the Soulglass packs.

Nothing here executes JavaScript — there is no Node in this project. What it
covers is the class of mistake that has actually broken this add-on: a rename
applied to only half the files, a config key that moved, a translation key
missing from one language, and characters that wreck the in-game font.

Usage:  python tools/check.py
Exit code 1 when anything fails, so CI can gate on it.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
PACK_KINDS = ("behavior_packs", "resource_packs")
EXTERNAL_MODULES = ("@minecraft/",)

failures = []
warnings = []


def fail(where, line, message):
    failures.append(f"{where}:{line}  {message}")


def warn(where, line, message):
    warnings.append(f"{where}:{line}  {message}")


def load_json(path, where):
    """Invalid JSON makes the whole pack refuse to load, with no clear error."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(where, e.lineno, f"invalid JSON: {e.msg}")
        return None


def check_manifest(path, where):
    data = load_json(path, where)
    if data is None:
        return

    header = data.get("header", {})
    for field in ("name", "uuid", "version", "min_engine_version"):
        if field not in header:
            fail(where, 1, f"header is missing '{field}'")

    uuids = [header.get("uuid")]
    kinds = []
    for module in data.get("modules", []):
        uuids.append(module.get("uuid"))
        kinds.append(module.get("type"))
        if module.get("type") == "script" and "entry" not in module:
            fail(where, 1, "script module has no 'entry'")

    seen = set()
    for uuid in uuids:
        if uuid in seen:
            fail(where, 1, f"duplicate UUID: {uuid}")
        seen.add(uuid)

    # An entities/ folder is only read when a 'data' module is declared.
    if (path.parent / "entities").is_dir() and "data" not in kinds:
        fail(where, 1, "entities/ exists but the manifest declares no 'data' module")


def callback_body(text, start):
    """
    The body of the callback beginning after `start`, delimited by braces.

    A fixed-size window will not do: it spills into the next function and
    reports a side effect that lives somewhere else entirely.
    """
    opening = text.find("{", start)
    if opening < 0:
        return None
    depth = 0
    for i in range(opening, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[opening:i + 1]
    return None


def exported_names(text):
    names = set()
    for m in re.finditer(r"^export\s+(?:async\s+)?function\s+(\w+)", text, re.M):
        names.add(m.group(1))
    for m in re.finditer(r"^export\s+(?:const|let|var|class)\s+(\w+)", text, re.M):
        names.add(m.group(1))
    return names


def imported_names(text):
    """[(names, source, line)] for every braced import."""
    found = []
    for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", text):
        names = [n.strip().split(" as ")[0].strip() for n in m.group(1).split(",")]
        line = text[: m.start()].count("\n") + 1
        found.append(([n for n in names if n], m.group(2), line))
    return found


def translation_keys(pack):
    """
    Keys defined per language. The client resolves them, so they live in the
    resource pack; the behavior pack only carries its own name and description.
    """
    keys = {}
    text_dirs = [pack / "texts"]
    for kind in PACK_KINDS:
        text_dirs.extend((ROOT / kind).glob("*/texts"))

    for text_dir in text_dirs:
        if not text_dir.is_dir():
            continue
        for lang_file in text_dir.glob("*.lang"):
            defined = keys.setdefault(lang_file.stem, set())
            for line in lang_file.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    defined.add(line.split("=", 1)[0].strip())
    return keys


def check_pack(pack):
    rel_pack = pack.relative_to(ROOT)
    manifest = pack / "manifest.json"
    if not manifest.exists():
        fail(str(rel_pack), 1, "no manifest.json")
        return []
    check_manifest(manifest, str(rel_pack / "manifest.json"))

    for path in pack.rglob("*.json"):
        if path.name != "manifest.json":
            load_json(path, str(path.relative_to(ROOT)))

    files = sorted(pack.rglob("*.js"))
    sources = {f: f.read_text(encoding="utf-8") for f in files}
    exports = {f: exported_names(t) for f, t in sources.items()}
    keys_by_language = translation_keys(pack)
    config = pack / "scripts" / "config.js"

    for path, text in sources.items():
        where = str(path.relative_to(ROOT))

        # A local import must exist and export the name being asked for.
        for names, source, line in imported_names(text):
            if source.startswith(EXTERNAL_MODULES):
                continue
            target = (path.parent / source).resolve()
            if not target.exists():
                fail(where, line, f"import of a file that does not exist: {source}")
                continue
            available = exports.get(target, set())
            for name in names:
                if name not in available:
                    fail(where, line, f"'{name}' is not exported by {source}")

        # Every CONFIG key used must exist in config.js.
        if config.exists() and path != config:
            config_text = sources.get(config, "")
            for m in re.finditer(r"CONFIG\.(\w+)", text):
                key = m.group(1)
                if not re.search(rf"^\s*{key}\s*:", config_text, re.M):
                    line = text[: m.start()].count("\n") + 1
                    fail(where, line, f"CONFIG.{key} does not exist in config.js")

        # Displayed text must stay within Latin-1: above U+00FF Minecraft
        # redraws the entire line in its fallback font.
        for m in re.finditer(r'"((?:[^"\\]|\\.)*)"', text):
            literal = m.group(1)
            if "§" not in literal:
                continue
            for char in literal:
                if ord(char) > 0xFF:
                    line = text[: m.start()].count("\n") + 1
                    fail(where, line, f"U+{ord(char):04X} '{char}' in shown text changes the font")
                    break

        # Every translation key used must exist in EVERY language file, or a
        # player reads a raw key such as "soulglass.hud.none" in the chat.
        #
        # The search matches ANY literal starting with the pack namespace, not
        # just those inside t(...): keys held in an array would slip past a
        # call-site match.
        if keys_by_language:
            pattern = rf'"({re.escape(pack.name)}\.[\w.]+)"'
            for m in re.finditer(pattern, text):
                key = m.group(1)
                line = text[: m.start()].count("\n") + 1
                for language, defined in sorted(keys_by_language.items()):
                    if key not in defined:
                        fail(where, line, f"key '{key}' missing from {language}.lang")

        # Not a syntax check, but it exposes a truncated edit.
        for opening, closing in (("{", "}"), ("(", ")"), ("[", "]")):
            if text.count(opening) != text.count(closing):
                warn(where, 1, f"unbalanced '{opening}' and '{closing}'")

        # Side effects inside beforeEvents are rejected by the API at runtime.
        for m in re.finditer(r'beforeEvents,\s*"(\w+)"', text):
            line = text[: m.start()].count("\n") + 1
            body = callback_body(text, m.end())
            if body is None:
                continue
            touches_world = re.search(
                r"\b(sendMessage|setActionBar|spawnItem|setType|addItem)\(", body
            )
            if touches_world and "system.run" not in body:
                warn(where, line, f"beforeEvents.{m.group(1)}: side effect may be outside system.run")

    return files


def main():
    packs = []
    for kind in PACK_KINDS:
        packs.extend(sorted(p.parent for p in (ROOT / kind).glob("*/manifest.json")))

    if not packs:
        print("no packs found", file=sys.stderr)
        return 1

    total = 0
    for pack in packs:
        files = check_pack(pack)
        total += len(files)
        print(f"  {pack.relative_to(ROOT)}: {len(files)} js files")

    print(f"\n{total} files checked across {len(packs)} packs\n")

    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings:
            print("  " + w)
        print()

    if failures:
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print("  " + f)
        return 1

    print("no failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
