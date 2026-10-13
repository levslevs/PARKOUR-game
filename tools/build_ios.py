#!/usr/bin/env python3
"""Build the self-contained game resource for the iPad app. Python 3.10+."""

import argparse
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "ios" / "ParkourEnemies" / "Game" / "parkour-enemies.html"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Write the offline game to this path instead of the iPad app resource folder.",
    )
    args = parser.parse_args()
    target = args.output.expanduser().resolve()

    # Reuse the web builder so native and browser releases have the same gameplay,
    # prices, levels, and embedded artwork. No network or third-party tools are used.
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "build.py"), "--output", str(target)],
        cwd=ROOT,
        check=False,
    )
    if result.returncode:
        return result.returncode

    print(f"iPad game ready: {target} ({target.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
