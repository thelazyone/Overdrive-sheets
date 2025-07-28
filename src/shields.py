from PIL import Image, ImageDraw, ImageFont

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

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
            draw._image.paste(shield_slot_img, (current_x, front_y), shield_slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot
        draw._image.paste(shield_energy_img, (current_x, front_y), shield_energy_img)
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
            draw._image.paste(shield_slot_img, (current_x, rear_y), shield_slot_img)
            current_x += icon_size + 4
        
        # Draw one energy slot
        draw._image.paste(shield_energy_img, (current_x, rear_y), shield_energy_img)
        current_x += icon_size + 4 