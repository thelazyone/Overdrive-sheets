"""
Renders a shields system (kind \"shields\" with front/rear columns) as a single
system tile, consistent with the ship sheet shield display.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from .shields import create_shield_block, get_text_size
from .system import load_fonts


def _draw_labeled_shield_row(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    start_y: int,
    tile_width: int,
    label: str,
    values: list[int],
    label_font,
    icon_size: int,
) -> int:
    label_h = 0
    if label:
        lw, label_h = get_text_size(draw, label, label_font)
        draw.text(((tile_width - lw) // 2, start_y), label, font=label_font, fill="black")
    row_y = start_y + label_h + 8

    if not values:
        width_needed = icon_size + 4
    else:
        width_needed = (icon_size + 4) + (len(values) + sum(values)) * (icon_size + 4)
    left_margin = 20
    current_x = max(
        left_margin, (tile_width - min(width_needed, tile_width - 2 * left_margin)) // 2
    )

    no_shield = create_shield_block("none", icon_size)
    img.paste(no_shield, (current_x, row_y), no_shield)
    current_x += icon_size + 4

    for n in (values or []):
        for _ in range(int(n)):
            slot = create_shield_block("slot", icon_size)
            img.paste(slot, (current_x, row_y), slot)
            current_x += icon_size + 4
        en = create_shield_block("energy", icon_size)
        img.paste(en, (current_x, row_y), en)
        current_x += icon_size + 4

    return row_y + icon_size + 16


def create_shields_system_tile(system: dict, tile_width_px: int, tile_height_px: int, dpi: int) -> Image.Image:
    title_font, subtitle_font, _, _, _ = load_fonts(dpi, tile_width_px)
    h_buf = int(tile_height_px * 2)
    img = Image.new("RGB", (tile_width_px, h_buf), "white")
    draw = ImageDraw.Draw(img)

    vertical_margin = int(tile_height_px * 0.02)
    y = vertical_margin
    name = (system.get("name") or "Shields").upper()
    w, h = get_text_size(draw, name, title_font)
    draw.text(((tile_width_px - w) // 2, y), name, font=title_font, fill="black")
    y += h + 8

    rules = (system.get("rules") or "").replace("Â°", "°")
    if rules:
        for line in rules.split("\n"):
            if not line.strip():
                y += 4
                continue
            lw, lh = get_text_size(draw, line, subtitle_font)
            draw.text(((tile_width_px - lw) // 2, y), line, font=subtitle_font, fill="black")
            y += lh + 2
        y += 4

    try:
        front = [int(x) for x in (system.get("front") or []) if str(x).strip() != ""]
    except (TypeError, ValueError):
        front = []
    try:
        rear = [int(x) for x in (system.get("rear") or []) if str(x).strip() != ""]
    except (TypeError, ValueError):
        rear = []

    icon_size = max(32, min(50, int(tile_width_px * 0.05)))

    y = _draw_labeled_shield_row(
        img, draw, y, tile_width_px, "FRONT SHIELDS", front, subtitle_font, icon_size
    )
    y = _draw_labeled_shield_row(
        img, draw, y, tile_width_px, "REAR SHIELDS", rear, subtitle_font, icon_size
    )

    y += vertical_margin
    draw.rectangle([(0, 0), (tile_width_px, y)], outline="black", width=8)
    return img.crop((0, 0, tile_width_px, y))
