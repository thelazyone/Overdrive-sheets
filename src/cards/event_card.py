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

def create_event_card(
    card_data,
    card_width_px,
    card_height_px,
    title_font,
    subtitle_font,
    description_font,
    image_height_ratio,
    image_vertical_position,
    card_margin,
    title_to_image_spacing,
    image_to_content_spacing,
    content_to_traits_spacing,
    traits_area_height,
    show_borders,
    border_width
):
    """Create an event card."""
    # Create white canvas for the card
    card_img = Image.new("RGB", (card_width_px, card_height_px), "white")
    draw = ImageDraw.Draw(card_img)
    
    content_width = card_width_px - (2 * card_margin)
    
    # Draw card type label (rotated 90° in top-right)
    card_type_text = "EVENT"
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
    
    # Draw description
    description_text = card_data.get("Description", "").strip()
    content_y = content_start_y
    max_content_y = card_height_px - card_margin - traits_area_height - content_to_traits_spacing
    
    if description_text:
        desc_lines = wrap_text(description_text, description_font, content_width, draw)
        line_height = description_font.size + 4
        
        for line in desc_lines:
            if content_y + line_height > max_content_y:
                break
            draw.text((card_margin, content_y), line, font=description_font, fill="black")
            content_y += line_height
    
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

