import os
from PIL import Image, ImageDraw
from .utils import get_text_size, load_trait_icon

def wrap_text(text, font, max_width, draw):
    """Wrap text to fit within max_width. Supports explicit line breaks using \n."""
    # First, handle explicit line breaks by splitting on \n
    manual_lines = text.split('\n')
    
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

def create_character_card(
    card_data,
    card_width_px,
    card_height_px,
    title_font,
    subtitle_font,
    description_font,
    ability_font,
    single_use_font,
    image_height_ratio,
    image_vertical_position,
    card_margin,
    title_to_image_spacing,
    image_to_content_spacing,
    content_to_traits_spacing,
    traits_area_height,
    single_use_rectangle_padding,
    single_use_grey_color,
    show_borders,
    border_width
):
    """Create a character card."""
    # Create white canvas for the card
    card_img = Image.new("RGB", (card_width_px, card_height_px), "white")
    draw = ImageDraw.Draw(card_img)
    
    content_width = card_width_px - (2 * card_margin)
    
    # Draw card type label (rotated 90° in top-right)
    card_type_text = "CHARACTER"
    type_w, type_h = get_text_size(draw, card_type_text, subtitle_font)
    
    # Create rotated text
    type_img = Image.new('RGBA', (type_h, type_w), (255, 255, 255, 0))
    type_draw = ImageDraw.Draw(type_img)
    type_draw.text((0, 0), card_type_text, font=subtitle_font, fill="black")
    type_img_rotated = type_img.rotate(90, expand=True)
    
    # Position rotated text in top-right
    type_x = card_width_px - card_margin - type_img_rotated.width
    type_y = card_margin
    card_img.paste(type_img_rotated, (type_x, type_y), type_img_rotated)

    print("Generating CHARACTER text at x: ", type_x, "y: ", type_y)
    
    # Draw title (positioned to avoid card type label)
    title_text = card_data.get("Title", "").upper()
    if title_text:
        title_w, title_h = get_text_size(draw, title_text, title_font)
        # Leave space for card type label on the right
        max_title_width = card_width_px - (2 * card_margin) - type_img_rotated.width - 10
        title_x = card_margin + (max_title_width - title_w) // 2
        title_y = card_margin
        draw.text((title_x, title_y), title_text, font=title_font, fill="black")
        current_y = title_y + title_h + title_to_image_spacing

        print("Generating TITLE text at x: ", title_x, "y: ", title_y)

    else:
        current_y = card_margin + title_to_image_spacing

    
    # Load and draw image
    image_path = card_data.get("Image path", "").strip()
    image_y = int(card_height_px * image_vertical_position)
    image_height = int(card_height_px * image_height_ratio)
    
    if image_path and os.path.exists(image_path):
        try:
            img = Image.open(image_path)
            # Calculate width maintaining aspect ratio
            aspect_ratio = img.width / img.height
            image_width = int(image_height * aspect_ratio)
            
            # Resize if too wide
            if image_width > content_width:
                image_width = content_width
                image_height = int(image_width / aspect_ratio)
            
            img = img.resize((image_width, image_height), Image.Resampling.LANCZOS)
            image_x = (card_width_px - image_width) // 2
            card_img.paste(img, (image_x, image_y))
            image_bottom = image_y + image_height
        except Exception as e:
            print(f"Warning: Could not load image {image_path}: {e}")
            image_bottom = image_y + image_height
    else:
        image_bottom = image_y + image_height
    
    # Start content area below image
    content_start_y = image_bottom + image_to_content_spacing
    max_content_y = card_height_px - card_margin - traits_area_height - content_to_traits_spacing
    available_height = max_content_y - content_start_y
    
    # Generate passive and active abilities
    passive_text = card_data.get("Passive ability", "").strip()
    active_text = card_data.get("Active ability", "").strip()
    
    ability_parts = []
    
    if passive_text:
        ability_parts.append(("passive", passive_text))
    
    if active_text:
        ability_parts.append(("active", active_text))
    
    # Calculate total height needed for abilities (first pass)
    ability_content_width = content_width - (single_use_rectangle_padding * 2)
    if active_text:
        ability_content_width -= 30  # Reserve space for vertical "SINGLE USE" text
    
    line_height = ability_font.size + 4
    ability_spacing = 10
    
    # Pre-calculate heights for all abilities
    ability_heights = []
    total_ability_height = 0
    
    for ability_type, ability_text in ability_parts:
        lines = wrap_text(ability_text, ability_font, ability_content_width, draw)
        text_height = len(lines) * line_height
        
        if ability_type == "active":
            # Add padding for rectangle
            text_height += (single_use_rectangle_padding * 2)
        
        ability_heights.append((ability_type, ability_text, lines, text_height))
        total_ability_height += text_height
        if len(ability_parts) > 1 and ability_type != ability_parts[-1][0]:  # Not the last one
            total_ability_height += ability_spacing
    
    # Center the abilities block vertically
    content_y = content_start_y + (available_height - total_ability_height) // 2
    
    # Draw abilities (second pass)
    for ability_type, ability_text, lines, text_height in ability_heights:
        # For active abilities, draw grey rectangle and "SINGLE USE" text first
        if ability_type == "active":
            # Draw grey rectangle
            rect_y = content_y - single_use_rectangle_padding
            rect_height = text_height
            rect_x = card_margin
            rect_width = content_width
            
            draw.rectangle(
                [(rect_x, rect_y), (rect_x + rect_width, rect_y + rect_height)],
                fill=single_use_grey_color,
                outline=None
            )
            
            # Draw "SINGLE USE" vertically on the right
            single_use_text = "SINGLE USE"
            single_use_w, single_use_h = get_text_size(draw, single_use_text, single_use_font)
            
            # Create rotated text for vertical
            single_use_img = Image.new('RGBA', (single_use_h, single_use_w), (255, 255, 255, 0))
            single_use_draw = ImageDraw.Draw(single_use_img)
            single_use_draw.text((0, 0), single_use_text, font=single_use_font, fill="black")
            single_use_img_rotated = single_use_img.rotate(90, expand=True)
            
            single_use_x = card_width_px - card_margin - single_use_img_rotated.width - 5
            single_use_y = rect_y + (rect_height - single_use_img_rotated.height) // 2
            card_img.paste(single_use_img_rotated, (single_use_x, single_use_y), single_use_img_rotated)
        
        # Draw ability text
        text_start_y = content_y
        if ability_type == "active":
            text_start_y += single_use_rectangle_padding
        
        for i, line in enumerate(lines):
            draw.text((card_margin + single_use_rectangle_padding, text_start_y + (i * line_height)), 
                     line, font=ability_font, fill="black")
        
        content_y += text_height + ability_spacing
    
    # Draw traits icons at bottom
    traits_text = card_data.get("Traits", "").strip()
    if traits_text:
        trait_names = [t.strip() for t in traits_text.split(';') if t.strip()]
        
        if trait_names:
            trait_icons = []
            for trait_name in trait_names:
                icon = load_trait_icon(trait_name, traits_area_height)
                if icon:
                    trait_icons.append(icon)
            
            if trait_icons:
                icon_spacing = 5
                total_width = sum(icon.width for icon in trait_icons) + (len(trait_icons) - 1) * icon_spacing
                start_x = (card_width_px - total_width) // 2
                traits_y = card_height_px - card_margin - traits_area_height
                
                current_x = start_x
                for icon in trait_icons:
                    icon_y = traits_y + (traits_area_height - icon.height) // 2
                    card_img.paste(icon, (current_x, icon_y), icon)
                    current_x += icon.width + icon_spacing
    
    # Draw card border
    if show_borders:
        draw.rectangle(
            [(0, 0), (card_width_px - 1, card_height_px - 1)],
            outline="black",
            width=border_width
        )
    
    return card_img

