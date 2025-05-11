import json
from PIL import Image, ImageDraw, ImageFont
import os
import math
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
import io
import tempfile

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

def draw_weapon_symbol(draw, x, y, size, damage, range_val, font):
    """Draw a weapon symbol with damage and range values."""
    # Load and resize the symbol image
    symbol_img = Image.open("resources/arrow_symbol.png")
    # Resize to 60px height while maintaining aspect ratio
    aspect_ratio = symbol_img.width / symbol_img.height
    target_height = 60
    target_width = int(target_height * aspect_ratio)
    symbol_img = symbol_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    # Create a new image with alpha channel for anti-aliasing
    final_img = Image.new('RGBA', symbol_img.size, (255, 255, 255, 0))
    final_draw = ImageDraw.Draw(final_img)
    
    # Paste the symbol
    final_img.paste(symbol_img, (0, 0), symbol_img)
    
    # Draw the numbers in large Eurostile font
    # Left number (damage)
    damage_w, damage_h = get_text_size(final_draw, str(damage), font)
    damage_x = (symbol_img.width/4 - damage_w) // 2  + 15
    damage_y = (symbol_img.height - damage_h) // 2 - 5
    final_draw.text((damage_x, damage_y), str(damage), font=font, fill="black")
    
    # Right number (range)
    range_w, range_h = get_text_size(final_draw, str(range_val), font)
    range_x = symbol_img.width/2 + (symbol_img.width/4 - range_w) // 2  + 5
    range_y = (symbol_img.height - range_h) // 2 - 5
    final_draw.text((range_x, range_y), str(range_val), font=font, fill="black")
    
    # Paste the final image onto the main image
    draw._image.paste(final_img, (x, y), final_img)
    return target_height

def wrap_text(text, font, max_width, draw):
    """Wrap text to fit within max_width."""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        width, _ = get_text_size(draw, test_line, font)
        
        if width <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines

def load_fonts(dpi, tile_width_px):
    """Load the required fonts with appropriate sizes."""
    # Font sizes as percentages of tile width
    title_font_size = int(tile_width_px * 0.06)      # 5% of width
    subtitle_font_size = int(tile_width_px * 0.05)    # 4% of width
    area_title_font_size = int(tile_width_px * 0.04)  # 3.5% of width
    description_font_size = int(tile_width_px * 0.04)  # 3% of width
    combat_number_font_size = int(tile_width_px * 0.05)  # 4.5% of width
    
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
    
    return energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img

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
    if "rules" in system and system["rules"]:
        rules_text = system["rules"].replace("Â°", "°")
        rules_w, rules_h = get_text_size(draw, rules_text, subtitle_font)
        rules_x = (effective_width - rules_w) // 2
        rules_y = current_y
        draw.text((rules_x, rules_y), rules_text, font=subtitle_font, fill="black")
        return rules_h + vertical_spacing
    return 0

def generate_action(draw, area, content_x, area_title_font, description_font, vertical_spacing):
    """Generate a single action (area) with its content."""
    content_height = 0
    elements = []
    
    # Draw weapon symbol if it exists
    weapon_width = 0
    if "shoot" in area:
        weapon_img = Image.new('RGBA', (150, 60), (255, 255, 255, 0))
        weapon_draw = ImageDraw.Draw(weapon_img)
        weapon_height = draw_weapon_symbol(weapon_draw, 0, 0, 150,
                          area["shoot"]["damage"],
                          area["shoot"]["range"],
                          area_title_font)
        weapon_width = weapon_img.width
        elements.append(("image", (content_x, content_height), weapon_img))
        content_height = max(content_height, weapon_height)
    
    # Draw description
    if area["description"]:
        desc_text = area["description"].replace("Â°", "°")
        desc_w, desc_h = get_text_size(draw, desc_text, description_font)
        desc_x = content_x + (weapon_width + 20 if "shoot" in area else 0)
        
        if "shoot" in area:
            desc_y = 0
        else:
            baseline_offset = description_font.size // 4
            desc_y = (60 - desc_h) // 2 - baseline_offset
        
        elements.append(("text", (desc_x, desc_y), desc_text, description_font))
        content_height = max(content_height, desc_h if "shoot" in area else 60)
    
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

def generate_mess_content(draw, system, title_font, subtitle_font, area_title_font, description_font, med_bay_img, tile_width_px, current_y, vertical_spacing):
    """Generate content for the Mess system."""
    mess_height = 200
    current_y += mess_height

    if "med_bay" in system and system["med_bay"] > 0:
        med_bay_ratio = 0.275
        med_bay_width = int(tile_width_px * med_bay_ratio)
        main_section_width = tile_width_px - med_bay_width
        
        # Draw vertical divider
        divider_padding = 20
        divider_x = main_section_width
        draw.line([(divider_x, divider_padding), 
                  (divider_x, current_y - divider_padding)], 
                 fill="black", width=2)
        
        # Draw med bay symbols
        med_bay_count = system["med_bay"]
        symbol_width = med_bay_img.width
        gap = 10
        
        start_x = divider_x + (med_bay_width - symbol_width) // 2 - 50
        total_simbols_width = med_bay_count * (symbol_width) + gap * min(med_bay_count - 1, 0)
        start_y = current_y // 2 - total_simbols_width // 2
        
        for i in range(med_bay_count):
            pos_y = start_y + (i * (symbol_width + gap))
            draw._image.paste(med_bay_img, (start_x, pos_y), med_bay_img)
        
        # Draw "MED BAY" text vertically
        med_bay_font_size = int(area_title_font.size * 0.75)
        med_bay_font = ImageFont.truetype(EUROSTILE_BOLD, med_bay_font_size)
        med_bay_text = "MED BAY"
        med_bay_w, med_bay_h = get_text_size(draw, med_bay_text, med_bay_font)
        
        # Create text image with extra padding
        padding = 10
        # Create a taller image to accommodate the rotated text
        text_img = Image.new('RGBA', (med_bay_w + padding*2, med_bay_h + padding*2), (255, 255, 255, 0))
        text_draw = ImageDraw.Draw(text_img)
        text_draw.text((padding, padding), med_bay_text, font=med_bay_font, fill="black")
        
        # Rotate the text
        text_img = text_img.rotate(-90, expand=True)
        
        # Position the text at the right edge of the med bay section
        med_bay_x = divider_x + med_bay_width - text_img.width   # 10px padding from right edge
        med_bay_y = current_y - mess_height - text_img.height // 2 + 24
        draw._image.paste(text_img, (med_bay_x, med_bay_y), text_img)
    
    return current_y

def generate_reactor_content(draw, system, energy_large_img, current_y, vertical_spacing):
    """Generate content for the Reactor system."""
    empty_space_height = 150
    if "circles" in system:
        energy_count = system["circles"]
        symbol_width = energy_large_img.width
        gap = 20
        total_width = (energy_count * symbol_width) + ((energy_count - 1) * gap)
        
        start_x = (draw._image.width - total_width) // 2
        symbol_y = current_y + (empty_space_height - energy_large_img.height) // 2
        
        for i in range(energy_count):
            pos_x = start_x + (i * (symbol_width + gap))
            draw._image.paste(energy_large_img, (pos_x, symbol_y), energy_large_img)
    
    return current_y + empty_space_height + vertical_spacing

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
        bg_y = current_y - bg_height
        
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

def create_system(system, tile_width_px, tile_height_px, dpi):
    """Create a generic system tile."""
    # Create canvas
    img = Image.new("RGB", (tile_width_px, tile_height_px), "white")
    draw = ImageDraw.Draw(img)
    
    # Load resources
    title_font, subtitle_font, area_title_font, description_font, combat_number_font = load_fonts(dpi, tile_width_px)
    energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img = load_resource_symbols()
    
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
    
    # Generate areas
    if "areas" in system and system["areas"]:
        area_margin = int(tile_height_px * 0.02)
        current_y += area_margin
        
        for idx, area in enumerate(system["areas"]):
            if idx > 0:
                divider_y = current_y + vertical_spacing
                divider_start_x = (tile_width_px - (tile_width_px * 0.5)) // 2
                divider_end_x = divider_start_x + (tile_width_px * 0.5)
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
                                                             area_title_font, description_font,
                                                             vertical_spacing)
            
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
    elif system["name"].lower() not in ["mess", "reactor"]:
        min_system_height = 100
        current_y += min_system_height
    
    # Generate system icons
    current_y = generate_system_icons(draw, system, hull_img, electric_img, life_support_img, current_y)
    
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

if __name__ == "__main__":
    # For testing: generate all systems
    with open("systems.json", "r") as f:
        systems_data = json.load(f)
    with open("cores.json", "r") as f:
        cores_data = json.load(f)
    with open("mess.json", "r") as f:
        mess_data = json.load(f)
    
    # Process regular systems
    for system in systems_data.get("systems", []):
        img = create_system_image(system)
        if not os.path.exists("systems"):
            os.makedirs("systems")
        base_name = system["name"].lower().replace(" ", "_")
        filename = f"{base_name}.jpg"
        filepath = os.path.join("systems", filename)
        img.save(filepath, quality=95)
        print(f"Generated system image: {filepath}")
    
    # Process cores
    for core in cores_data.get("cores", []):
        img = create_system_image(core)
        if not os.path.exists("systems"):
            os.makedirs("systems")
        base_name = f"core_{core['circles']}_{core['rules'].split(': ')[1]}"
        filename = f"{base_name}.jpg"
        filepath = os.path.join("systems", filename)
        img.save(filepath, quality=95)
        print(f"Generated system image: {filepath}")
    
    # Process mess halls
    for mess in mess_data.get("mess_halls", []):
        img = create_system_image(mess)
        if not os.path.exists("systems"):
            os.makedirs("systems")
        base_name = f"mess_{mess['rules'].split(': ')[1]}"
        filename = f"{base_name}.jpg"
        filepath = os.path.join("systems", filename)
        img.save(filepath, quality=95)
        print(f"Generated system image: {filepath}") 