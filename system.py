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
    """Load and resize the energy and crew symbols."""
    energy_img = Image.open("resources/energy_symbol.png")
    energy_large_img = Image.open("resources/energy_symbol_large.png")
    crew_img = Image.open("resources/crew_symbol.png")
    med_bay_img = Image.open("resources/med_bay_symbol.png")
    hull_img = Image.open("resources/hull_icon.png")
    electric_img = Image.open("resources/electric_icon.png")
    life_support_img = Image.open("resources/life_support_icon.png")
    
    # Resize both to 60px height while maintaining aspect ratio
    energy_aspect = energy_img.width / energy_img.height
    crew_aspect = crew_img.width / crew_img.height
    energy_img = energy_img.resize((int(60 * energy_aspect), 60), Image.Resampling.LANCZOS)
    crew_img = crew_img.resize((int(60 * crew_aspect), 60), Image.Resampling.LANCZOS)
    
    # Resize large energy symbol to 120px height while maintaining aspect ratio
    large_energy_aspect = energy_large_img.width / energy_large_img.height
    energy_large_img = energy_large_img.resize((int(120 * large_energy_aspect), 120), Image.Resampling.LANCZOS)
    
    # Resize med bay symbol to 150px height while maintaining aspect ratio
    med_bay_aspect = med_bay_img.width / med_bay_img.height
    med_bay_img = med_bay_img.resize((int(120 * med_bay_aspect), 120), Image.Resampling.LANCZOS)
    
    # Resize system icons to 40px height while maintaining aspect ratio
    icon_size = 40
    hull_aspect = hull_img.width / hull_img.height
    electric_aspect = electric_img.width / electric_img.height
    life_support_aspect = life_support_img.width / life_support_img.height
    
    hull_img = hull_img.resize((int(icon_size * hull_aspect), icon_size), Image.Resampling.LANCZOS)
    electric_img = electric_img.resize((int(icon_size * electric_aspect), icon_size), Image.Resampling.LANCZOS)
    life_support_img = life_support_img.resize((int(icon_size * life_support_aspect), icon_size), Image.Resampling.LANCZOS)
    
    return energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img

def draw_resource_symbols(draw, x, y, energy_count, crew_count, energy_img, crew_img):
    """Draw energy and crew symbols in a grid layout."""
    symbols = []
    for _ in range(energy_count):
        symbols.append(("energy", energy_img))
    for _ in range(crew_count):
        symbols.append(("crew", crew_img))
    
    if not symbols:
        return 0
    
    # Calculate grid layout
    if len(symbols) == 1:
        grid_cols = 1
        grid_rows = 1
    elif len(symbols) == 2:
        grid_cols = 2
        grid_rows = 1
    elif len(symbols) == 3:
        grid_cols = 2
        grid_rows = 2
    else:  # 4 symbols
        grid_cols = 2
        grid_rows = 2
    
    # Draw symbols in grid
    symbol_size = 60
    gap = 10
    total_width = grid_cols * symbol_size + (grid_cols - 1) * gap
    total_height = grid_rows * symbol_size + (grid_rows - 1) * gap
    
    start_x = x
    start_y = y
    
    for idx, (symbol_type, symbol_img) in enumerate(symbols):
        if idx >= 4:  # Safety check
            break
        row = idx // grid_cols
        col = idx % grid_cols
        pos_x = start_x + col * (symbol_size + gap)
        pos_y = start_y + row * (symbol_size + gap)
        draw._image.paste(symbol_img, (pos_x, pos_y), symbol_img)
    
    return total_height

def create_area_content(draw, area, content_x, area_title_font, description_font, vertical_spacing):
    """Create the right column content (weapon, description) and return its height."""
    content_height = 0
    elements = []
    
    # Calculate the maximum height for this area
    max_height = 0
    
    # Draw weapon symbol if it exists
    weapon_width = 0
    if "shoot" in area:
        # Create temporary image for weapon symbol
        weapon_img = Image.new('RGBA', (150, 60), (255, 255, 255, 0))
        weapon_draw = ImageDraw.Draw(weapon_img)
        weapon_height = draw_weapon_symbol(weapon_draw, 0, 0, 150,
                          area["shoot"]["damage"],
                          area["shoot"]["range"],
                          area_title_font)
        weapon_width = weapon_img.width
        elements.append(("image", (content_x, content_height), weapon_img))
        max_height = max(max_height, weapon_height)
    
    # Draw description to the right of the weapon if it exists, otherwise at content_x
    if area["description"]:
        desc_text = area["description"].replace("Â°", "°")
        desc_w, desc_h = get_text_size(draw, desc_text, description_font)
        # If there's a weapon, start description to its right, otherwise at content_x
        desc_x = content_x + (weapon_width + 20 if "shoot" in area else 0)  # 20px gap between weapon and description
        
        # Calculate text baseline position
        if "shoot" in area:
            # When there's a weapon, align text with the weapon
            desc_y = 0
        else:
            # When there's no weapon, center the text vertically
            # Get the font's baseline offset (approximately 1/4 of the font size)
            baseline_offset = description_font.size // 4
            desc_y = (60 - desc_h) // 2 - baseline_offset
        
        elements.append(("text", (desc_x, desc_y), desc_text, description_font))
        max_height = max(max_height, desc_h if "shoot" in area else 60)  # Use weapon height as minimum when no weapon
    
    # Update content height based on the maximum height of elements
    content_height = max_height
    
    return content_height, elements

def create_cost_symbols(draw, energy_count, crew_count, energy_img, crew_img):
    """Create the cost symbols and return their height."""
    symbols = []
    for _ in range(energy_count):
        symbols.append(("energy", energy_img))
    for _ in range(crew_count):
        symbols.append(("crew", crew_img))
    
    if not symbols:
        return 0, []
    
    # Calculate grid layout
    if len(symbols) == 1:
        grid_cols = 1
        grid_rows = 1
    elif len(symbols) == 2:
        grid_cols = 2
        grid_rows = 1
    elif len(symbols) == 3:
        grid_cols = 2
        grid_rows = 2
    else:  # 4 symbols
        grid_cols = 2
        grid_rows = 2
    
    # Calculate dimensions
    symbol_size = 60
    gap = 10
    total_width = grid_cols * symbol_size + (grid_cols - 1) * gap
    total_height = grid_rows * symbol_size + (grid_rows - 1) * gap
    
    # Create temporary image for symbols
    symbols_img = Image.new('RGBA', (total_width, total_height), (255, 255, 255, 0))
    symbols_draw = ImageDraw.Draw(symbols_img)
    
    for idx, (symbol_type, symbol_img) in enumerate(symbols):
        if idx >= 4:  # Safety check
            break
        row = idx // grid_cols
        col = idx % grid_cols
        pos_x = col * (symbol_size + gap)
        pos_y = row * (symbol_size + gap)
        symbols_img.paste(symbol_img, (pos_x, pos_y), symbol_img)
    
    return total_height, symbols_img

def create_tile(system, tile_width_px, tile_height_px, dpi):
    """Create a single system tile with the new 2:1 ratio format."""
    # Create a white canvas for the tile with fixed width but temporary height
    # We'll crop it later to the actual content height
    img = Image.new("RGB", (tile_width_px, tile_height_px), "white")
    draw = ImageDraw.Draw(img)
    
    # Load fonts
    title_font, subtitle_font, area_title_font, description_font, combat_number_font = load_fonts(dpi, tile_width_px)
    
    # Load resource symbols
    energy_img, energy_large_img, crew_img, med_bay_img, hull_img, electric_img, life_support_img = load_resource_symbols()
    
    # Calculate margins and spacing
    vertical_margin = int(tile_height_px * 0.02)  # 2% margin
    horizontal_margin = int(tile_width_px * 0.02)  # 2% margin
    content_width = tile_width_px - (2 * horizontal_margin)
    vertical_spacing = int(tile_height_px * 0.01)  # 1% spacing between elements
    
    # Calculate title position (will be written at the end)
    title_text = system["name"].upper()
    title_w, title_h = get_text_size(draw, title_text, title_font)
    title_x = (tile_width_px - title_w) // 2
    title_y = vertical_margin
    
    current_y = title_y + title_h + vertical_spacing
    
    # Draw the rules (subtitle)
    if "rules" in system and system["rules"]:
        # Replace any degree symbol with the proper Unicode degree sign
        rules_text = system["rules"].replace("Â°", "°")
        rules_w, rules_h = get_text_size(draw, rules_text, subtitle_font)
        rules_x = (tile_width_px - rules_w) // 2
        rules_y = current_y
        current_y += rules_h + vertical_spacing
        
        # Add extra space and energy symbols for special systems
        if system["name"].lower() == "mess":
            current_y += 150  # Add empty space

            if "med_bay" in system and system["med_bay"] > 0:
                med_bay_width = int(tile_width_px * 0.3)  # 30% of width for med bay section
                main_section_width = tile_width_px - med_bay_width
                title_x = title_x - med_bay_width/2
                rules_x = rules_x - med_bay_width/2
                
                # Draw vertical divider with padding
                divider_padding = 20  # Padding from top and bottom
                divider_x = main_section_width
                draw.line([(divider_x, current_y - 150 + divider_padding), 
                          (divider_x, current_y - divider_padding)], 
                         fill="black", width=2)
                
                # Draw med bay symbols vertically
                med_bay_count = system["med_bay"]
                symbol_width = med_bay_img.width
                gap = 20  # Gap between symbols
                
                # Calculate starting position for vertical layout
                start_x = divider_x + (med_bay_width - symbol_width) // 2
                start_y = current_y - 150 + (150 - (med_bay_count * (symbol_width + gap) - gap)) // 2
                
                # Draw each med bay symbol vertically
                for i in range(med_bay_count):
                    pos_y = start_y + (i * (symbol_width + gap))
                    img.paste(med_bay_img, (start_x, pos_y), med_bay_img)
                
                # Draw "MED BAY" text vertically (smaller font)
                med_bay_font_size = int(area_title_font.size * 0.8)  # 80% of original size
                med_bay_font = ImageFont.truetype(EUROSTILE_BOLD, med_bay_font_size)
                med_bay_text = "MED BAY"
                med_bay_w, med_bay_h = get_text_size(draw, med_bay_text, med_bay_font)
                
                # Rotate the text 90 degrees clockwise
                med_bay_img = Image.new('RGBA', (med_bay_h, med_bay_w), (255, 255, 255, 0))
                med_bay_draw = ImageDraw.Draw(med_bay_img)
                med_bay_draw.text((0, 0), med_bay_text, font=med_bay_font, fill="black")
                med_bay_img = med_bay_img.rotate(90, expand=True)
                
                # Position the rotated text on the right edge
                med_bay_x = divider_x + (med_bay_width - med_bay_img.width) // 2
                med_bay_y = current_y - 150 + (150 - med_bay_img.height) // 2
                img.paste(med_bay_img, (med_bay_x, med_bay_y), med_bay_img)
            
        elif system["name"].lower() == "reactor":
            # Calculate the center position for the large energy symbols
            empty_space_height = 150
            if "circles" in system:
                energy_count = system["circles"]
                # Calculate total width of all energy symbols with spacing
                symbol_width = energy_large_img.width
                gap = 20  # Gap between symbols
                total_width = (energy_count * symbol_width) + ((energy_count - 1) * gap)
                
                # Calculate starting x position to center all symbols
                start_x = (tile_width_px - total_width) // 2
                symbol_y = current_y + (empty_space_height - energy_large_img.height) // 2
                
                # Draw each energy symbol
                for i in range(energy_count):
                    pos_x = start_x + (i * (symbol_width + gap))
                    img.paste(energy_large_img, (pos_x, symbol_y), energy_large_img)
            
            current_y += empty_space_height + vertical_spacing
    
    # Draw the areas
    if "areas" in system and system["areas"]:
        area_margin = int(tile_height_px * 0.02)  # 2% margin for areas
        current_y += area_margin  # Add initial margin before first area
        
        for idx, area in enumerate(system["areas"]):
            if idx > 0:  # Draw divider between areas
                divider_y = current_y + vertical_spacing
                # Calculate center position for the divider
                divider_start_x = (tile_width_px - (tile_width_px * 0.5)) // 2  # 50% width, centered
                divider_end_x = divider_start_x + (tile_width_px * 0.5)
                draw.line([(divider_start_x, divider_y), 
                          (divider_end_x, divider_y)], 
                         fill="black", width=2)
                current_y = divider_y + vertical_spacing
            
            # Calculate column positions
            cost_column_width = 150  # Width for cost symbols
            content_column_width = tile_width_px - 2 * horizontal_margin - cost_column_width - 20  # 20px gap
            content_x = horizontal_margin + cost_column_width + 20
            
            # Create cost symbols
            cost_height, cost_img = create_cost_symbols(draw,
                                                      area["cost"].get("energy", 0),
                                                      area["cost"].get("crew", 0),
                                                      energy_img,
                                                      crew_img)
            
            # Create content
            content_height, content_elements = create_area_content(draw, area, content_x,
                                                                 area_title_font, description_font,
                                                                 vertical_spacing)
            
            # Calculate vertical alignment with minimum height
            min_area_height = 100  # Increased minimum height for better spacing
            total_height = max(min_area_height, max(cost_height, content_height))
            
            # Add padding to single areas
            if len(system["areas"]) == 1:
                total_height = max(total_height, 120)  # Ensure single areas have more height
            
            # Center align the cost symbols vertically
            cost_y = current_y + (total_height - cost_height) // 2
            
            # Draw cost symbols
            if cost_img:
                img.paste(cost_img, (horizontal_margin, cost_y), cost_img)
            
            # Draw content elements with proper vertical centering
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
        
        current_y += area_margin  # Add final margin after last area
    elif system["name"].lower() not in ["mess", "reactor"]:  # Only apply minimum height to non-special systems
        # If no areas exist, add minimum height
        min_system_height = 100  # Minimum height for systems without areas
        current_y += min_system_height
    
    # Add system icons in bottom right if they exist
    icons = []
    if system.get("hull", False):
        icons.append(hull_img)
    if system.get("electronics", False):
        icons.append(electric_img)
    if system.get("life_support", False):
        icons.append(life_support_img)
    
    if icons:
        # Calculate total width of all icons with spacing
        icon_spacing = 10
        total_width = sum(img.width for img in icons) + (len(icons) - 1) * icon_spacing
        
        # Create black background
        bg_padding = 10
        bg_width = total_width + (2 * bg_padding)
        bg_height = icons[0].height + (2 * bg_padding)
        
        # Position at the very edge
        bg_x = tile_width_px - bg_width
        bg_y = current_y - bg_height
        
        # Calculate slope for 30 degrees
        # tan(30°) ≈ 0.577
        slope_width = int(bg_height * 0.577)  # This will be the horizontal distance of the slope
        
        # Create sloped rectangle (wider at bottom)
        points = [
            (bg_x, bg_y),  # Top left
            (bg_x + bg_width, bg_y),  # Top right
            (bg_x + bg_width, bg_y + bg_height),  # Bottom right
            (bg_x - slope_width, bg_y + bg_height),  # Bottom left (sloped)
            (bg_x, bg_y)  # Back to top left
        ]
        
        # Draw black background with slope
        draw.polygon(points, fill="black")
        
        # Draw icons
        current_x = bg_x + bg_padding
        for icon in icons:
            img.paste(icon, (current_x, bg_y + bg_padding), icon)
            current_x += icon.width + icon_spacing
    
    # Draw black border
    draw.rectangle([(0,0), (tile_width_px, current_y)], outline="black", width=8)
    
    # Draw the title at the end
    draw.text((title_x, title_y), title_text, font=title_font, fill="black")
    draw.text((rules_x, rules_y), rules_text, font=subtitle_font, fill="black")
    
    # Crop the image to the actual content height
    final_height = current_y
    img = img.crop((0, 0, tile_width_px, final_height))
    
    return img

def create_system_image(system, output_folder="systems"):
    """Create a single system image and return its path."""
    # Create output directory if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
    # Calculate pixel dimensions based on DPI
    tile_width_px = int(round(TILE_WIDTH_CM * DPI / 2.54))
    tile_height_px = int(round(TILE_HEIGHT_CM * DPI / 2.54))
    
    # Generate the system image
    tile_img = create_tile(system, tile_width_px, tile_height_px, DPI)
    
    # Generate filename based on system type
    if system["name"].lower() == "core":
        base_name = f"core_{system['circles']}_{system['rules'].split(': ')[1]}"
    elif system["name"].lower() == "mess":
        base_name = f"mess_{system['rules'].split(': ')[1]}"
    else:
        base_name = system["name"].lower().replace(" ", "_")
    
    filename = f"{base_name}.jpg"
    filepath = os.path.join(output_folder, filename)
    
    # Save the image
    tile_img.save(filepath, quality=95)  # Using high quality for JPG
    print(f"Generated system image: {filepath}")
    
    return filepath

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
        create_system_image(system)
    
    # Process cores
    for core in cores_data.get("cores", []):
        create_system_image(core)
    
    # Process mess halls
    for mess in mess_data.get("mess_halls", []):
        create_system_image(mess) 