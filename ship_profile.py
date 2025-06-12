import json
from PIL import Image, ImageDraw, ImageFont
import os
from system import create_system_image

# Constants for A5 format (horizontal orientation)
A5_WIDTH_CM = 21.0  # A5 width in cm
A5_HEIGHT_CM = 14.8  # A5 height in cm
DPI = 300
SYSTEM_SCALE = 0.75  # Scale factor for systems

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def get_system_unique_id(system):
    """Generate a unique identifier for a system based on name and key properties."""
    # Start with the name
    unique_id = system["name"]
    
    # Add rules if present
    if "rules" in system and system["rules"]:
        unique_id += f"_rules_{system['rules']}"
    
    # Add weapon flag if present
    if system.get("weapon", False):
        unique_id += "_weapon"
    
    # Add main flag if present  
    if system.get("main", False):
        unique_id += "_main"
    
    # Add hull/electronics/life_support flags for further differentiation
    if system.get("hull", False):
        unique_id += "_hull"
    if system.get("electronics", False):
        unique_id += "_electronics"
    if system.get("life_support", False):
        unique_id += "_life_support"
    
    # If there are areas, add a hash of their content for uniqueness
    if "areas" in system and system["areas"]:
        areas_str = str(sorted([str(area) for area in system["areas"]]))
        unique_id += f"_areas_{hash(areas_str) % 10000}"  # Use modulo to keep it manageable
    
    return unique_id

def load_fonts(font_path_resolver=None):
    """Load fonts with optional path resolver for bundled resources."""
    def resolve_path(path):
        if font_path_resolver:
            return font_path_resolver(path)
        return path
    
    try:
        title_font = ImageFont.truetype(resolve_path("fonts/Eurostile Extended Bold.ttf"), 48)
    except:
        title_font = ImageFont.load_default()
        
    try:
        subtitle_font = ImageFont.truetype(resolve_path("fonts/TitilliumWeb-SemiBold.ttf"), 36)
    except:
        subtitle_font = ImageFont.load_default()
        
    try:
        stats_font = ImageFont.truetype(resolve_path("fonts/Eurostile Extended Bold.ttf"), 36)
    except:
        stats_font = ImageFont.load_default()
        
    try:
        shields_font = ImageFont.truetype(resolve_path("fonts/Eurostile Extended Bold.ttf"), 28)
    except:
        shields_font = ImageFont.load_default()
        
    try:
        label_font = ImageFont.truetype(resolve_path("fonts/Eurostile Extended Bold.ttf"), 24)
    except:
        label_font = ImageFont.load_default()
    
    return title_font, subtitle_font, stats_font, shields_font, label_font

def create_ship_sheet(ship_data, output_path, resource_path_resolver=None):
    """Create a ship sheet with the given data.
    
    Args:
        ship_data: Dictionary containing ship configuration
        output_path: Path where the generated image should be saved
        resource_path_resolver: Optional function to resolve resource paths (for bundled executables)
    """
    def resolve_resource(path):
        if resource_path_resolver:
            return resource_path_resolver(path)
        return path
    
    # Calculate pixel dimensions based on DPI
    width_px = int(round(A5_WIDTH_CM * DPI / 2.54))
    height_px = int(round(A5_HEIGHT_CM * DPI / 2.54))
    
    # Create a white canvas
    img = Image.new("RGB", (width_px, height_px), "white")
    draw = ImageDraw.Draw(img)
    
    # Load fonts
    title_font, subtitle_font, stats_font, shields_font, label_font = load_fonts(resource_path_resolver)
    
    # Draw the ship title
    title_text = ship_data["title"].upper()
    title_w, title_h = get_text_size(draw, title_text, title_font)
    title_x = (width_px - title_w) // 2
    title_y = 50
    draw.text((title_x, title_y), title_text, font=title_font, fill="black")
    
    # Draw the ship subtitle
    subtitle_text = ship_data["subtitle"]
    subtitle_w, subtitle_h = get_text_size(draw, subtitle_text, subtitle_font)
    subtitle_x = (width_px - subtitle_w) // 2
    subtitle_y = title_y + title_h + 20
    draw.text((subtitle_x, subtitle_y), subtitle_text, font=subtitle_font, fill="black")
    
    # Draw Command-Control values at the edges
    command_text = f"COMMAND {ship_data.get('command', 0)}"
    control_text = f"CONTROL {ship_data.get('control', 0)}"
    command_w, command_h = get_text_size(draw, command_text, stats_font)
    control_w, control_h = get_text_size(draw, control_text, stats_font)
    
    # Position command and control at the edges
    box_margin = 20  # Margin from bottom of page
    command_x = box_margin  # Left edge
    control_x = width_px - control_w - box_margin  # Right edge
    command_y = title_y  # Align with title
    control_y = title_y  # Align with title
    
    draw.text((command_x, command_y), command_text, font=stats_font, fill="black")
    draw.text((control_x, control_y), control_text, font=stats_font, fill="black")
    
    # Create bottom boxes
    box_height = 300  # Increased height for boxes
    box_margin = 20  # Margin from bottom of page
    box_y = height_px - box_height - box_margin
    
    # Calculate box widths (one third of page width each)
    box_width = width_px // 3 - box_margin
    
    # Generate Reactor and Mess images
    reactor_img = create_system_image(ship_data["reactor"])
    mess_img = create_system_image(ship_data["mess"])
    
    # Scale images to fit in box
    scale_factor = (box_width) / max(reactor_img.width, mess_img.width)  # 40px padding
    new_width = int(reactor_img.width * scale_factor)
    new_height = int(reactor_img.height * scale_factor)
    reactor_img = reactor_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    new_width = int(mess_img.width * scale_factor)
    new_height = int(mess_img.height * scale_factor)
    mess_img = mess_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Position reactor at bottom left
    reactor_x = box_margin
    reactor_y = height_px - reactor_img.height - box_margin  # 20px from bottom
    
    # Position mess above reactor
    mess_x = box_margin
    mess_y = reactor_y - mess_img.height - 20  # 20px gap between mess and reactor
    
    # Paste images
    img.paste(mess_img, (mess_x, mess_y))
    img.paste(reactor_img, (reactor_x, reactor_y))
    
    # Right box (Shields)
    right_box_x = width_px - box_width - box_margin
    
    # Draw right box border
    draw.rectangle([(right_box_x, box_y), 
                   (right_box_x + box_width, box_y + box_height)], 
                  outline="black", width=8)
    
    # Load shield icons
    shield_slot_img = Image.open(resolve_resource("resources/shield_slot.png"))
    shield_energy_img = Image.open(resolve_resource("resources/shield_slot_energy.png"))
    
    # Resize shield icons to 80px
    icon_size = 80
    shield_slot_img = shield_slot_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    shield_energy_img = shield_energy_img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    
    # Create shield displays
    shield_data = ship_data.get("shields", {"front": [0, 0, 0], "rear": [0, 0]})
    front_shields = shield_data.get("front", [0, 0, 0])
    rear_shields = shield_data.get("rear", [0, 0])
    
    # Calculate total height needed for each shield group (label + icons)
    label_height = 40  # Height for label
    shield_group_height = label_height + icon_size
    
    # Calculate vertical spacing to center both groups in box
    total_height = shield_group_height * 2  # Two groups
    start_y = box_y + (box_height - total_height) // 2
    
    # Draw front shields
    front_y = start_y - 10
    front_label = "FRONT SHIELDS"
    front_label_w, _ = get_text_size(draw, front_label, shields_font)
    front_label_x = right_box_x + (box_width - front_label_w) // 2
    draw.text((front_label_x, front_y), front_label, font=shields_font, fill="black")
    front_y += label_height
    
    # Calculate total width of front shields
    front_shields_width = (len(front_shields) + sum(front_shields)) * (icon_size + 4) - 4  # -4 to remove last gap
    current_x = right_box_x + (box_width - front_shields_width) // 2
    
    for shield_value in front_shields:
        # Draw empty shield slots
        for _ in range(shield_value):
            img.paste(shield_slot_img, (current_x, front_y), shield_slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot
        img.paste(shield_energy_img, (current_x, front_y), shield_energy_img)
        current_x += icon_size + 4
    
    # Draw rear shields
    rear_y = start_y + shield_group_height + 10
    rear_label = "REAR SHIELDS"
    rear_label_w, _ = get_text_size(draw, rear_label, shields_font)
    rear_label_x = right_box_x + (box_width - rear_label_w) // 2
    draw.text((rear_label_x, rear_y), rear_label, font=shields_font, fill="black")
    rear_y += label_height
    
    # Calculate total width of rear shields
    rear_shields_width = (len(rear_shields) + sum(rear_shields)) * (icon_size + 4) - 4  # -4 to remove last gap
    current_x = right_box_x + (box_width - rear_shields_width) // 2
    
    for shield_value in rear_shields:
        # Draw empty shield slots
        for _ in range(shield_value):
            img.paste(shield_slot_img, (current_x, rear_y), shield_slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot
        img.paste(shield_energy_img, (current_x, rear_y), shield_energy_img)
        current_x += icon_size + 4
    
    # Start systems below subtitle
    current_y = subtitle_y + subtitle_h + 50  # 50px margin from subtitle
    
    # Create three columns for systems
    column_margin = 8  # Space between columns
    side_margin = 16  # Space from edges of page
    
    # Calculate column width to ensure proper centering
    available_width = width_px - (2 * side_margin) - (2 * column_margin)  # Total width minus margins
    column_width = available_width // 3
    
    # Calculate system tile dimensions (no scaling)
    system_width = column_width
    
    # Add column labels
    label_spacing = 20  # Space between label and columns
    
    # Calculate total width of all columns including margins
    total_columns_width = (3 * column_width) + (2 * column_margin)
    start_x = (width_px - total_columns_width) // 2
    
    # Draw column labels
    labels = ["LEFT", "CENTER", "RIGHT"]
    for i, label in enumerate(labels):
        label_w, label_h = get_text_size(draw, label, label_font)
        label_x = start_x + (i * (column_width + column_margin)) + (column_width - label_w) // 2
        label_y = current_y
        draw.text((label_x, label_y), label, font=label_font, fill="black")
    
    # Move columns down to account for labels
    current_y += label_h + label_spacing
    
    # Draw systems in columns
    current_y_columns = current_y
    
    # Prepare core column without Reactor and Mess
    core_systems = ship_data["sections"]["core"].copy()
    
    # First pass: generate all system images and calculate heights
    system_images = {}  # Store generated images
    column_heights = []
    
    # Process left and right columns
    for section in ["left", "right"]:
        column_height = 0
        for system in ship_data["sections"][section]:
            # Generate the system image if not already generated
            system_id = get_system_unique_id(system)
            if system_id not in system_images:
                system_img = create_system_image(system)
                # Scale the image to match our desired width
                scale_factor = system_width / system_img.width
                new_height = int(system_img.height * scale_factor)
                system_img = system_img.resize((system_width, new_height), Image.Resampling.LANCZOS)
                system_images[system_id] = system_img
            column_height += system_images[system_id].height + column_margin
        column_heights.append(column_height - column_margin)  # Remove last margin
    
    # Process core column
    core_height = 0
    for system in core_systems:
        # Skip if this is a Mess system (it's handled separately)
        if system["name"].lower() == "mess":
            continue
        # Generate the system image if not already generated
        system_id = get_system_unique_id(system)
        if system_id not in system_images:
            system_img = create_system_image(system)
            # Scale the image to match our desired width
            scale_factor = system_width / system_img.width
            new_height = int(system_img.height * scale_factor)
            system_img = system_img.resize((system_width, new_height), Image.Resampling.LANCZOS)
            system_images[system_id] = system_img
        core_height += system_images[system_id].height + column_margin
    core_height -= column_margin  # Remove last margin
    column_heights.insert(1, core_height)  # Insert core height in the middle
    
    # Draw each column independently
    for col_idx, section in enumerate(["left", "right"]):
        # Calculate x position based on column index
        current_x = start_x + (col_idx * 2 * (column_width + column_margin))
        
        # Start at the top with margin
        current_y = current_y_columns
        
        for system in ship_data["sections"][section]:
            system_img = system_images[get_system_unique_id(system)]
            img.paste(system_img, (current_x, current_y))
            current_y += system_img.height + column_margin
    
    # Draw core column
    current_x = start_x + column_width + column_margin
    
    # Start at the top with margin
    current_y = current_y_columns
    
    for system in core_systems:
        system_img = system_images[get_system_unique_id(system)]
        img.paste(system_img, (current_x, current_y))
        current_y += system_img.height + column_margin
    
    # Save the final image
    img.save(output_path)
    print(f"Saved ship sheet to: {output_path}") 