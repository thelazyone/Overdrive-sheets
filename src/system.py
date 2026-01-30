import json
from PIL import Image, ImageDraw, ImageFont
import os
import math
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
import io
import tempfile
from .attack_symbols import draw_weapon_symbol, draw_engine_symbol
from .firing_arcs import draw_firing_arc
from .engine import generate_engine_content
from .reactor import generate_reactor_content
from .mess import generate_mess_content

# Constants for the new tile format
TILE_WIDTH_CM = 8  # 8cm width
TILE_HEIGHT_CM = 4  # 4cm height (2:1 ratio)
DPI = 300

# Font paths
FONTS_DIR = "fonts"
EUROSTILE_BOLD = os.path.join(FONTS_DIR, "Eurostile Extended Bold.ttf")
TITILLIUM_SEMIBOLD = os.path.join(FONTS_DIR, "TitilliumWeb-SemiBold.ttf")
TITILLIUM_REGULAR = os.path.join(FONTS_DIR, "TitilliumWeb-Regular.ttf")

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def create_weapon_symbol_svg(x, y, width, height):
    """Create an SVG string for the weapon symbol."""
    # Calculate the points for the shape
    points = [
        f"{x},{y}",  # 0,0
        f"{x + width},{y}",  # width,0
        f"{x + width + 30},{y + height/2}",  # width+30,height/2
        f"{x + width},{y + height}",  # width,height
        f"{x},{y + height}",  # 0,height
        f"{x},{y}"  # 0,0
    ]
    
    # Create the SVG path
    path_data = f"M {' L '.join(points)} Z"
    
    # Create the SVG string
    svg = f'''<svg width="{width + 30}" height="{height}" xmlns="http://www.w3.org/2000/svg">
        <path d="{path_data}" 
              stroke="black" 
              stroke-width="9" 
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"/>
    </svg>'''
    
    return svg

# Weapon and engine symbols moved to attack_symbols.py

def wrap_text(text, font, max_width, draw):
    """Wrap text to fit within max_width. Supports explicit line breaks using \\n."""
    # First, handle explicit line breaks by splitting on \n
    manual_lines = text.split('\\n')  # Use \\n as line break marker in JSON
    
    all_lines = []
    for manual_line in manual_lines:
        # Handle empty lines (for spacing)
        if not manual_line.strip():
            all_lines.append('')
            continue
            
        # Apply word wrapping to each manual line
        words = manual_line.split()
        current_line = []
        
        for word in words:
            test_line = ' '.join(current_line + [word])
            width, _ = get_text_size(draw, test_line, font)
            
            if width <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    all_lines.append(' '.join(current_line))
                current_line = [word]
        
        if current_line:
            all_lines.append(' '.join(current_line))
    
    return all_lines

def load_fonts(dpi, tile_width_px):
    """Load the required fonts with appropriate sizes."""
    # Font sizes as percentages of tile width
    title_font_size = 45
    subtitle_font_size = 40
    area_title_font_size = 32 # Used for the "MED BAY" text only. TODO rename.
    description_font_size = 40
    combat_number_font_size = 41
    
    try:
        title_font = ImageFont.truetype(EUROSTILE_BOLD, title_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        title_font = ImageFont.load_default()
    
    try:
        subtitle_font = ImageFont.truetype(TITILLIUM_SEMIBOLD, subtitle_font_size)
    except IOError:
        print(f"Warning: Could not load {TITILLIUM_SEMIBOLD}, falling back to default font")
        subtitle_font = ImageFont.load_default()
    
    try:
        area_title_font = ImageFont.truetype(EUROSTILE_BOLD, area_title_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        area_title_font = ImageFont.load_default()
    
    try:
        description_font = ImageFont.truetype(TITILLIUM_SEMIBOLD, description_font_size)
    except IOError:
        print(f"Warning: Could not load {TITILLIUM_REGULAR}, falling back to default font")
        description_font = ImageFont.load_default()
    
    try:
        combat_number_font = ImageFont.truetype(EUROSTILE_BOLD, combat_number_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        combat_number_font = ImageFont.load_default()
    
    return title_font, subtitle_font, area_title_font, description_font, combat_number_font

def load_resource_symbols():
    """Load all resource symbols used in systems."""
    energy_img = Image.open("resources/energy_symbol.png")
    energy_large_img = Image.open("resources/energy_symbol_large.png")
    crew_img = Image.open("resources/crew_symbol.png")
    med_bay_img = Image.open("resources/med_bay_symbol.png")
    hull_img = Image.open("resources/hull_icon.png")
    electric_img = Image.open("resources/electric_icon.png")
    life_support_img = Image.open("resources/life_support_icon.png")
    weapon_img = Image.open("resources/weapon_icon.png")
    star_img = Image.open("resources/star_icon.png")
    
    # Resize all symbols to 60x60
    icon_size = 60
    large_icon_size = 120
    energy_img = energy_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    energy_large_img = energy_large_img.resize((large_icon_size, large_icon_size), Image.Resampling.LANCZOS)
    crew_img = crew_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    med_bay_img = med_bay_img.resize((large_icon_size, large_icon_size), Image.Resampling.LANCZOS)
    hull_img = hull_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    electric_img = electric_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    life_support_img = life_support_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    weapon_img = weapon_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    star_img = star_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    return energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img, weapon_img, star_img

def generate_title(draw, system, title_font, effective_width, vertical_margin):
    """Generate the title for a system."""
    title_text = system["name"].upper()
    title_w, title_h = get_text_size(draw, title_text, title_font)
    title_x = (effective_width - title_w) // 2
    title_y = vertical_margin
    draw.text((title_x, title_y), title_text, font=title_font, fill="black")
    return title_h

def generate_rules(draw, system, subtitle_font, effective_width, current_y, vertical_spacing):
    """Generate the rules text for a system."""
    has_top_left_icons = system.get("weapon", False) or system.get("main", False)
    
    if "rules" in system and system["rules"]:
        rules_text = system["rules"].replace("Â°", "°")
        
        # Handle multi-line rules text
        rules_lines = wrap_text(rules_text, subtitle_font, effective_width - 20, draw)
        
        # Calculate total height for all lines
        line_height = subtitle_font.size + 4
        total_text_height = len(rules_lines) * line_height - 4  # Remove spacing after last line
        
        # Draw each line centered
        for i, line in enumerate(rules_lines):
            if line:  # Skip empty lines for spacing
                line_w, _ = get_text_size(draw, line, subtitle_font)
                line_x = (effective_width - line_w) // 2
                line_y = current_y + (i * line_height)
                draw.text((line_x, line_y), line, font=subtitle_font, fill="black")
        
        return max(total_text_height + vertical_spacing, 5 * vertical_spacing)
    elif has_top_left_icons:
        # If no rules but has top-left icons, provide the same minimum spacing as if there were rules
        return 8 * vertical_spacing
    return 0

def generate_action(draw, area, content_x, combat_number_font_size, description_font, vertical_spacing, max_desc_width):
    """Generate a single action (area) with its content."""
    content_height = 0
    elements = []
    
    # Draw weapon symbol if it exists
    weapon_width = 0
    if "shoot" in area:
        weapon_img = draw_weapon_symbol(draw, content_x, 0, 150,
                          area["shoot"]["damage"],
                          area["shoot"]["range"],
                          combat_number_font_size)
        weapon_width = weapon_img.width
        elements.append(("image", (content_x, 0), weapon_img))
        content_height = max(content_height, weapon_img.height)
    elif "engine" in area:
        engine_img = draw_engine_symbol(draw, content_x, 0, 150,
                          area["engine"]["speed"],
                          combat_number_font_size,
                          area["engine"]["steer"])
        weapon_width = engine_img.width
        elements.append(("image", (content_x, 0), engine_img))
        content_height = max(content_height, engine_img.height)
    
    # Draw description
    desc_end_x = content_x
    if area["description"]:
        desc_text = area["description"].replace("Â°", "°")
        desc_x = content_x + (weapon_width + 20 if "shoot" in area or "engine" in area else 0)
        
        # Calculate available width for description (reserve space for firing arc if needed)
        firing_arc_space = 0
        if "shoot" in area and "arc-start" in area["shoot"] and "arc-end" in area["shoot"]:
            firing_arc_space = 50  # 40px arc + 10px spacing
        
        available_width = max_desc_width - (weapon_width + 20 if "shoot" in area or "engine" in area else 0) - firing_arc_space
        
        # Wrap text if necessary
        wrapped_lines = wrap_text(desc_text, description_font, available_width - 30, draw)
        
        # Calculate total height of wrapped text
        line_height = description_font.size + 4  # Add some line spacing
        total_text_height = len(wrapped_lines) * line_height - 4  # Remove spacing after last line
        
        if "shoot" in area or "engine" in area:
            # Start from top when there's a weapon/engine symbol
            desc_y = 0
        else:
            # Center vertically when there's no symbol
            baseline_offset = description_font.size // 4
            desc_y = (60 - total_text_height) // 2 - baseline_offset
        
        # Add each line as a separate text element
        for i, line in enumerate(wrapped_lines):
            line_y = desc_y + (i * line_height)
            elements.append(("text", (desc_x, line_y), line, description_font))
        
        # Calculate the end position of the description text
        if wrapped_lines:
            last_line = wrapped_lines[-1]
            last_line_width, _ = get_text_size(draw, last_line, description_font)
            desc_end_x = desc_x + last_line_width
        
        content_height = max(content_height, total_text_height if "shoot" in area or "engine" in area else 60)
    else:
        # If no description, set desc_end_x to where description would start
        desc_end_x = content_x + (weapon_width + 20 if "shoot" in area or "engine" in area else 0)
    
    # Draw firing arc if weapon has arc information
    if "shoot" in area and "arc-start" in area["shoot"] and "arc-end" in area["shoot"]:
        arc_start = area["shoot"]["arc-start"]
        arc_end = area["shoot"]["arc-end"]
        
        # Create the firing arc image
        arc_img = draw_firing_arc(draw, arc_start, arc_end, size=80)
        
        # Position the arc after the description text (or where it would be)
        arc_x = desc_end_x + 10  # 10px spacing after text
        arc_y = (content_height - arc_img.height) // 2  # Center vertically
        
        elements.append(("image", (arc_x, arc_y), arc_img))
    
    return content_height, elements

def generate_cost_symbols(draw, energy_count, crew_count, energy_img, crew_img):
    """Generate cost symbols for an action."""
    symbols = []
    for _ in range(energy_count):
        symbols.append(("energy", energy_img))
    for _ in range(crew_count):
        symbols.append(("crew", crew_img))
    
    if not symbols:
        return 0, None
    
    # Calculate dimensions
    symbol_size = 60
    gap = 10
    
    # Calculate total height needed for all symbols
    total_height = 0
    remaining_symbols = len(symbols)
    while remaining_symbols > 0:
        if remaining_symbols >= 2:
            total_height += symbol_size + gap
        else:
            total_height += symbol_size
        remaining_symbols -= 2
    
    # Create temporary image for symbols
    symbols_img = Image.new('RGBA', (symbol_size * 2 + gap, total_height), (255, 255, 255, 0))
    symbols_draw = ImageDraw.Draw(symbols_img)
    
    # Draw symbols in pairs
    current_y = 0
    remaining_symbols = len(symbols)
    while remaining_symbols > 0:
        if remaining_symbols >= 2:
            # Draw a pair of symbols
            symbols_img.paste(symbols[0][1], (0, current_y), symbols[0][1])
            symbols_img.paste(symbols[1][1], (symbol_size + gap, current_y), symbols[1][1])
            symbols = symbols[2:]  # Remove the pair we just drew
            current_y += symbol_size + gap
            remaining_symbols -= 2
        else:
            # Center the last single symbol
            symbols_img.paste(symbols[0][1], ((symbol_size * 2 + gap - symbol_size) // 2, current_y), symbols[0][1])
            remaining_symbols -= 1
    
    return total_height, symbols_img

# Mess, reactor, and engine content generation moved to their respective modules

def generate_system_icons(draw, system, hull_img, electric_img, life_support_img, current_y):
    """Generate system icons in the bottom right."""
    icons = []
    if system.get("hull", False):
        icons.append(hull_img)
    if system.get("electronics", False):
        icons.append(electric_img)
    if system.get("life_support", False):
        icons.append(life_support_img)
    
    if icons:
        # Resize icons to a consistent size
        icon_size = 60  # Target size for icons
        resized_icons = []
        for icon in icons:
            # Create a new image with alpha channel for the resized icon
            resized_icon = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 0))
            # Calculate position to center the icon
            x = (icon_size - icon.width) // 2
            y = (icon_size - icon.height) // 2
            # Paste the original icon onto the new image
            resized_icon.paste(icon, (x, y), icon)
            resized_icons.append(resized_icon)
        
        icon_spacing = 10
        total_width = sum(img.width for img in resized_icons) + (len(resized_icons) - 1) * icon_spacing
        
        bg_padding = 10
        bg_width = total_width + (2 * bg_padding)
        bg_height = resized_icons[0].height + (2 * bg_padding)
        
        bg_x = draw._image.width - bg_width
        bg_y = current_y - bg_height + 2
        
        slope_width = int(bg_height * 0.577)
        
        points = [
            (bg_x, bg_y),
            (bg_x + bg_width, bg_y),
            (bg_x + bg_width, bg_y + bg_height),
            (bg_x - slope_width, bg_y + bg_height),
            (bg_x, bg_y)
        ]
        
        draw.polygon(points, fill="black")
        
        current_x = bg_x + bg_padding
        for icon in resized_icons:
            draw._image.paste(icon, (current_x, bg_y + bg_padding), icon)
            current_x += icon.width + icon_spacing
    
    return current_y

def generate_top_left_system_icons(draw, system, weapon_img, star_img, vertical_margin):
    """Generate system icons in the top left for weapon and main flags."""
    icons = []
    if system.get("weapon", False):
        icons.append(weapon_img)
    if system.get("main", False):
        icons.append(star_img)
    
    if icons:
        # Resize icons to a consistent size
        icon_size = 60  # Target size for icons
        resized_icons = []
        for icon in icons:
            # Create a new image with alpha channel for the resized icon
            resized_icon = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 0))
            # Calculate position to center the icon
            x = (icon_size - icon.width) // 2
            y = (icon_size - icon.height) // 2
            # Paste the original icon onto the new image
            resized_icon.paste(icon, (x, y), icon)
            resized_icons.append(resized_icon)
        
        icon_spacing = 10
        total_width = sum(img.width for img in resized_icons) + (len(resized_icons) - 1) * icon_spacing
        
        bg_padding = 10
        bg_width = total_width + (2 * bg_padding)
        bg_height = resized_icons[0].height + (2 * bg_padding)
        
        bg_x = 0
        bg_y = vertical_margin - 2
        
        slope_width = int(bg_height * 0.577)
        
        # Create points for 180-degree rotated shape (slope on the right side)
        points = [
            (bg_x, bg_y),
            (bg_x + bg_width + slope_width, bg_y),
            (bg_x + bg_width, bg_y + bg_height),
            (bg_x, bg_y + bg_height),
            (bg_x, bg_y)
        ]
        
        draw.polygon(points, fill="black")
        
        current_x = bg_x + bg_padding
        for icon in resized_icons:
            draw._image.paste(icon, (current_x, bg_y + bg_padding), icon)
            current_x += icon.width + icon_spacing

# Firing arc drawing moved to firing_arcs.py

def create_system(system, tile_width_px, tile_height_px, dpi):
    """Create a generic system tile."""
    # Create canvas with extra height to accommodate all content
    img = Image.new("RGB", (tile_width_px, tile_height_px * 2), "white")  # Double the height to ensure enough space
    draw = ImageDraw.Draw(img)
    
    # Load resources
    title_font, subtitle_font, area_title_font, description_font, combat_number_font = load_fonts(dpi, tile_width_px)
    energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img, weapon_img, star_img = load_resource_symbols()
    
    # Calculate margins and spacing
    vertical_margin = int(tile_height_px * 0.02)
    horizontal_margin = int(tile_width_px * 0.02)
    vertical_spacing = int(tile_height_px * 0.01)
    
    # Calculate effective width for title and rules
    effective_width = tile_width_px
    if system["name"].lower() == "mess" and "med_bay" in system and system["med_bay"] > 0:
        effective_width = int(tile_width_px * 0.7)  # 70% width for main section
    
    # Generate title
    current_y = generate_title(draw, system, title_font, effective_width, vertical_margin)
    current_y += vertical_spacing
    
    # Generate rules
    current_y += generate_rules(draw, system, subtitle_font, effective_width, current_y, vertical_spacing)
    
    # Handle special systems
    if system["name"].lower() == "mess":
        current_y = generate_mess_content(draw, system, title_font, subtitle_font, area_title_font, description_font, med_bay_img, tile_width_px, current_y, vertical_spacing)
    elif system["name"].lower() == "reactor":
        current_y = generate_reactor_content(draw, system, energy_large_img, current_y, vertical_spacing)
    elif system["name"].lower() == "engine":
        # Add extra spacing for engines to push slots down from title
        current_y += int(tile_height_px * 0.03)  # Additional spacing for engines
        # Generate engine speed slots after normal area processing
        current_y = generate_engine_content(draw, system, tile_width_px, current_y, vertical_spacing, area_title_font, combat_number_font)
    
    # Generate areas
    if "areas" in system and system["areas"]:
        area_margin = int(tile_height_px * 0.02)
        current_y += area_margin
        
        for idx, area in enumerate(system["areas"]):
            if idx > 0:
                divider_y = current_y + vertical_spacing
                divider_start_x = (tile_width_px - (tile_width_px * 0.9)) // 2
                divider_end_x = divider_start_x + (tile_width_px * 0.9)
                draw.line([(divider_start_x, divider_y), 
                          (divider_end_x, divider_y)], 
                         fill="black", width=2)
                current_y = divider_y + vertical_spacing
            
            cost_column_width = 150
            content_column_width = tile_width_px - 2 * horizontal_margin - cost_column_width - 20
            content_x = horizontal_margin + cost_column_width + 20
            
            cost_height, cost_img = generate_cost_symbols(draw,
                                                        area["cost"].get("energy", 0),
                                                        area["cost"].get("crew", 0),
                                                        energy_img,
                                                        crew_img)
            
            content_height, content_elements = generate_action(draw, area, content_x,
                                                             combat_number_font, description_font,
                                                             vertical_spacing, content_column_width)
            
            min_area_height = 100
            total_height = max(min_area_height, max(cost_height, content_height))
            
            if len(system["areas"]) == 1:
                total_height = max(total_height, 120)
            
            cost_y = current_y + (total_height - cost_height) // 2
            if cost_img:
                img.paste(cost_img, (horizontal_margin, cost_y), cost_img)
            
            content_y = current_y + (total_height - content_height) // 2
            for element in content_elements:
                element_type = element[0]
                x, y = element[1]
                content = element[2]
                if element_type == "text":
                    font = element[3]
                    draw.text((x, content_y + y), content, font=font, fill="black")
                elif element_type == "image":
                    img.paste(content, (x, content_y + y), content)
            
            current_y += total_height + vertical_spacing
        
        current_y += area_margin
    elif system["name"].lower() not in ["mess", "reactor", "engine"]:
        min_system_height = 100
        current_y += min_system_height
    
    # Generate system icons
    current_y = generate_system_icons(draw, system, hull_img, electric_img, life_support_img, current_y)
    
    # Generate top left system icons
    generate_top_left_system_icons(draw, system, weapon_img, star_img, vertical_margin)
    
    # Add padding at the bottom
    current_y += vertical_margin
    
    # Draw border
    draw.rectangle([(0,0), (tile_width_px, current_y)], outline="black", width=8)
    
    # Crop to actual content height
    img = img.crop((0, 0, tile_width_px, current_y))
    
    return img

def create_system_image(system, output_folder="systems"):
    """Create a single system image and return the image object."""
    tile_width_px = int(round(TILE_WIDTH_CM * DPI / 2.54))
    tile_height_px = int(round(TILE_HEIGHT_CM * DPI / 2.54))
    
    tile_img = create_system(system, tile_width_px, tile_height_px, DPI)
    
    return tile_img