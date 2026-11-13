#!/usr/bin/env python3
"""Install pinned open-source js-dos 8.5.4 test assets locally from npm.

No copyrighted game files are downloaded or copied. Outputs are gitignored.
Requires npm, a working network, and the two published npm packages.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "web_deploy/vendor/jsdos854"
PACKAGES = (("js-dos", "8.5.4"), ("emulators", "8.5.3"))


def pack(pkg: str, version: str, directory: Path) -> Path:
    command = ["npm", "pack", pkg + "@" + version, "--silent", "--pack-destination", str(directory)]
    proc = subprocess.run(command, check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError("npm pack failed for " + pkg + ": " + proc.stderr[-1400:])
    filename = proc.stdout.strip().splitlines()[-1]
    archive = directory / filename
    if not archive.is_file():
        raise RuntimeError("npm pack did not produce the expected file: " + str(archive))
    return archive


def extract_dist(archive: Path, target: Path) -> int:
    count = 0
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar:
            if not member.isfile() or not member.name.startswith("package/dist/"):
                continue
            relative = Path(member.name).relative_to("package/dist")
            if relative.is_absolute() or any(p in (".", "..") for p in relative.parts):
                raise ValueError("Unsafe npm dist archive path")
            output = target / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as data, output.open("wb") as dest:
                if data is None:
                    raise ValueError("Missing package bytes")
                shutil.copyfileobj(data, dest)
            count += 1
    return count


def install(dest: Path) -> None:
    if dest.is_symlink():
        raise ValueError("Refusing symlinked vendor directory")
    dest.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="r05-jsdos8-npm-") as temp:
        root = Path(temp)
        jsdos = pack(*PACKAGES[0], root)
        emulators = pack(*PACKAGES[1], root)
        frontend_count = extract_dist(jsdos, dest)
        backend_count = extract_dist(emulators, dest / "emulators")
    for required in ("js-dos.js", "js-dos.css", "emulators/emulators.js"):
        if not (dest / required).is_file():
            raise RuntimeError(
                "Missing published npm asset " + required +
                " (inspect package's dist layout before running v8 test)"
            )
    (dest / "versions.txt").write_text(
        "js-dos=8.5.4\nemulators=8.5.3\n"
        "Source: npmjs.com (published packages)\n",
        encoding="ascii"
    )
    print(f"Locally installed {frontend_count} frontend and {backend_count} backend files in {dest}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, default=DEST)
    args = parser.parse_args()
    try:
        install(args.dest)
    except (ValueError, RuntimeError, OSError, tarfile.TarError) as err:
        print("js-dos 8 setup failed: " + str(err), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
