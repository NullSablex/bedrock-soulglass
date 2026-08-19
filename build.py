#!/usr/bin/env python3
"""
Builds dist/Soulglass_v<version>.mcaddon from behavior_packs/ and resource_packs/.

The addon ships as one .mcaddon because it has two halves: the behavior pack
runs the logic, the resource pack carries the translation strings. A single
file installs both, so nobody ends up with a missing half.

Python rather than a shell script: Git Bash on Windows has no `zip`, and its
GNU tar cannot produce ZIP archives. Python's zipfile is in the standard
library and behaves the same on Windows, Linux and macOS.

Entry names are written with forward slashes on purpose. PowerShell's
Compress-Archive writes backslashes, which violates the ZIP spec and gets the
package rejected by several clients and by BDS.

Usage:  python build.py
"""

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent

# On disk both packs are called "soulglass", each under its own kind folder.
# Inside the archive they need distinct names or one would overwrite the other.
PARTS = [
    (Path("behavior_packs") / "soulglass", "soulglass_BP"),
    (Path("resource_packs") / "soulglass", "soulglass_RP"),
]


def read_version() -> str:
    manifest = json.loads((ROOT / PARTS[0][0] / "manifest.json").read_text(encoding="utf-8"))
    return ".".join(str(n) for n in manifest["header"]["version"])


def build() -> int:
    version = read_version()
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)

    package = dist / f"Soulglass_v{version}.mcaddon"
    package.unlink(missing_ok=True)

    written = 0
    with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as archive:
        for source, prefix in PARTS:
            folder = ROOT / source
            if not folder.is_dir():
                print(f"missing pack folder: {source}", file=sys.stderr)
                return 1

            for path in sorted(folder.rglob("*")):
                if not path.is_file():
                    continue
                entry = f"{prefix}/{path.relative_to(folder).as_posix()}"
                archive.write(path, entry)
                written += 1

    # Each pack's manifest.json has to sit at the root of its own folder, or
    # the game ignores that pack without a clear error.
    with zipfile.ZipFile(package) as archive:
        roots = {f"{prefix}/manifest.json" for _, prefix in PARTS}
        missing = roots - set(archive.namelist())
        if missing:
            print(f"manifest not at pack root: {', '.join(sorted(missing))}", file=sys.stderr)
            return 1

    print(f"built: {package}")
    print(f"  version: {version}")
    print(f"  files:   {written}")
    return 0


if __name__ == "__main__":
    sys.exit(build())
