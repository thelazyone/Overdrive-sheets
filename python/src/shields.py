from PIL import Image, ImageDraw, ImageFont

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def create_shield_block(block_type, icon_size):
    """
    Create a shield block icon.
    
    Args:
        block_type: 'none' (white with X), 'slot' (blue empty), or 'energy' (yellow)
        icon_size: Size of the icon in pixels
    
    Returns:
        PIL Image with the shield block
    """
    img = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Style parameters matching the existing shield icons
    corner_radius = int(icon_size * 0.25)
    border_width = max(4, int(icon_size * 0.05))
    
    # Choose fill color based on block type
    if block_type == 'none':
        fill_color = "white"
    elif block_type == 'slot':
        fill_color = (135, 206, 235)  # Light blue/cyan
    elif block_type == 'energy':
        fill_color = (255, 193, 37)  # Yellow/gold
    else:
        fill_color = "white"
    
    # Draw rounded rectangle with black border
    draw.rounded_rectangle(
        [(border_width//2, border_width//2), (icon_size - border_width//2, icon_size - border_width//2)],
        radius=corner_radius,
        fill=fill_color,
        outline="black",
        width=border_width
    )
    
    # If 'none' type, draw X
    if block_type == 'none':
        x_padding = icon_size // 4
        draw.line(
            [(x_padding, x_padding), (icon_size - x_padding, icon_size - x_padding)],
            fill="black",
            width=border_width
        )
        draw.line(
            [(icon_size - x_padding, x_padding), (x_padding, icon_size - x_padding)],
            fill="black",
            width=border_width
        )
    
    return img

def render_shields(draw, ship_data, right_box_x, box_y, box_width, box_height, shields_font, resource_path_resolver=None):
    """Render the shields section of the ship sheet."""
    def resolve_resource(path):
        if resource_path_resolver:
            return resource_path_resolver(path)
        return path
    
    # Draw right box border
    draw.rectangle([(right_box_x, box_y), 
                   (right_box_x + box_width, box_y + box_height)], 
                  outline="black", width=8)
    
    # Icon size
    icon_size = 80
    
    # Create shield displays
    shield_data = ship_data.get("shields", {"front": [0, 0, 0], "rear": [0, 0]})
    front_shields = shield_data.get("front", [0, 0, 0])
    rear_shields = shield_data.get("rear", [0, 0])
    
    # Calculate total height needed for each shield group (label + icons)
    label_height = 40
    shield_group_height = label_height + icon_size
    
    # Calculate vertical spacing to center both groups in box
    total_height = shield_group_height * 2
    start_y = box_y + (box_height - total_height) // 2
    
    # Draw front shields
    front_y = start_y - 10
    front_label = "FRONT SHIELDS"
    front_label_w, _ = get_text_size(draw, front_label, shields_font)
    front_label_x = right_box_x + (box_width - front_label_w) // 2
    draw.text((front_label_x, front_y), front_label, font=shields_font, fill="black")
    front_y += label_height
    
    # Calculate total width of front shields (1 "none" block + regular shields)
    front_shields_width = (icon_size + 4) + (len(front_shields) + sum(front_shields)) * (icon_size + 4) - 4
    current_x = right_box_x + (box_width - front_shields_width) // 2
    
    # Always draw "no shields" indicator first
    no_shield_img = create_shield_block('none', icon_size)
    draw._image.paste(no_shield_img, (current_x, front_y), no_shield_img)
    current_x += icon_size + 4
    
    # Draw the rest of the shields
    for shield_value in front_shields:
        # Draw empty shield slots (blue)
        for _ in range(shield_value):
            slot_img = create_shield_block('slot', icon_size)
            draw._image.paste(slot_img, (current_x, front_y), slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot (yellow)
        energy_img = create_shield_block('energy', icon_size)
        draw._image.paste(energy_img, (current_x, front_y), energy_img)
        current_x += icon_size + 4
    
    # Draw rear shields
    rear_y = start_y + shield_group_height + 10
    rear_label = "REAR SHIELDS"
    rear_label_w, _ = get_text_size(draw, rear_label, shields_font)
    rear_label_x = right_box_x + (box_width - rear_label_w) // 2
    draw.text((rear_label_x, rear_y), rear_label, font=shields_font, fill="black")
    rear_y += label_height
    
    # Calculate total width of rear shields (1 "none" block + regular shields)
    rear_shields_width = (icon_size + 4) + (len(rear_shields) + sum(rear_shields)) * (icon_size + 4) - 4
    current_x = right_box_x + (box_width - rear_shields_width) // 2
    
    # Always draw "no shields" indicator first
    no_shield_img = create_shield_block('none', icon_size)
    draw._image.paste(no_shield_img, (current_x, rear_y), no_shield_img)
    current_x += icon_size + 4
    
    # Draw the rest of the shields
    for shield_value in rear_shields:
        # Draw empty shield slots (blue)
        for _ in range(shield_value):
            slot_img = create_shield_block('slot', icon_size)
            draw._image.paste(slot_img, (current_x, rear_y), slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot (yellow)
        energy_img = create_shield_block('energy', icon_size)
        draw._image.paste(energy_img, (current_x, rear_y), energy_img)
        current_x += icon_size + 4 