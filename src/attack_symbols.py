from PIL import Image, ImageDraw, ImageFont

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def draw_weapon_symbol(draw, x, y, size, damage, range_val, font):
    """Draw a weapon symbol with damage and range values."""
    # Load and resize the symbol image
    if not isinstance(range_val, str) and range_val == "0-0":
        #error here
        print(f"Error: Range value is not a string and is not '0-0' for {damage} damage")

    is_long_arrow = False
    if isinstance(range_val, str) and len(range_val) > 2:  # If range is a string and longer than 2 chars
        is_long_arrow = True
        symbol_img = Image.open("resources/arrow_long_symbol.png")
    else:
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
    damage_x = 28 - (damage_w) // 2
    damage_y = (target_height - damage_h) // 2 - 4
    final_draw.text((damage_x, damage_y), str(damage), font=font, fill="black")
    
    # Right number (range)
    range_w, range_h = get_text_size(final_draw, str(range_val), font)
    range_x = 103 - (range_w) // 2 if is_long_arrow else 79 - (range_w) // 2
    range_y = (target_height - range_h) // 2 - 4
    final_draw.text((range_x, range_y), str(range_val), font=font, fill="black")
    
    return final_img

def draw_engine_symbol(draw, x, y, size, speed, font, steer_text=None):
    """Draw an engine symbol with speed value and steer text."""
    # Load and resize the symbol image
    symbol_img = Image.open("resources/arrow_empty_symbol.png")
    
    # Resize to 60px height while maintaining aspect ratio
    aspect_ratio = symbol_img.width / symbol_img.height
    target_height = 60
    target_width = int(target_height * aspect_ratio)
    symbol_img = symbol_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    # Calculate additional height needed for steer text if present
    extra_height = 0
    if steer_text:
        steer_text = steer_text.replace("Â°", "°")
        steer_w, steer_h = get_text_size(draw, steer_text, font)
        extra_height = steer_h + 10  # Add 10px padding between texts
    
    # Create a new image with alpha channel for anti-aliasing
    final_img = Image.new('RGBA', (target_width, target_height + extra_height), (255, 255, 255, 0))
    final_draw = ImageDraw.Draw(final_img)
    
    # Paste the symbol
    final_img.paste(symbol_img, (0, 0), symbol_img)
    
    # Draw the speed value in large Eurostile font
    speed_w, speed_h = get_text_size(final_draw, str(speed), font)
    speed_x = 55 - (speed_w) // 2
    speed_y = (target_height - speed_h) // 2 - 4
    final_draw.text((speed_x, speed_y), str(speed), font=font, fill="black")
    
    # Draw steer text below the arrow symbol if present
    if steer_text:
        steer_w, steer_h = get_text_size(final_draw, steer_text, font)
        steer_x = (target_width - steer_w) // 2  # Center horizontally
        steer_y = target_height + 5  # 5px padding below the arrow
        final_draw.text((steer_x, steer_y), steer_text, font=font, fill="black")
    
    return final_img 