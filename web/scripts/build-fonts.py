"""Convert the shared TTFs at ``fonts/`` into web-friendly WOFF2 files in
``web/public/fonts/``.

Why this is necessary
---------------------
Chrome's OTS (OpenType Sanitizer) rejects `Eurostile Extended Bold.ttf`
because its ``rangeShift`` header field is 96 instead of the expected 80 and
its cmap contains an over-long subtable. Pillow is lenient and accepts the
font, which is why the Python tool worked, but browsers refuse to decode it.

fontTools round-trips the font tables, rewriting the directory headers
cleanly; saving with ``flavor="woff2"`` also compresses the result for the
web (usually ~30% of the TTF size).

Run from the repo root:
    python web/scripts/build-fonts.py
"""

from __future__ import annotations

from pathlib import Path

from fontTools.ttLib import TTFont

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = REPO_ROOT / "fonts"
DST_DIR = REPO_ROOT / "web" / "public" / "fonts"

FONTS = [
    "Eurostile Extended Bold.ttf",
    "Eurostile Extended Regular.ttf",
    "TitilliumWeb-Regular.ttf",
    "TitilliumWeb-SemiBold.ttf",
    "TitilliumWeb-Bold.ttf",
]


def main() -> None:
    DST_DIR.mkdir(parents=True, exist_ok=True)
    for name in FONTS:
        src = SRC_DIR / name
        if not src.exists():
            print(f"skip: {name} not found")
            continue
        font = TTFont(str(src))
        font.flavor = "woff2"
        dst = DST_DIR / (Path(name).stem + ".woff2")
        font.save(str(dst))
        size_kb = dst.stat().st_size / 1024
        print(f"built: {dst.relative_to(REPO_ROOT)}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
