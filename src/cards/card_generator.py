import os
from PIL import Image, ImageDraw, ImageFont
from .character_card import create_character_card
from .mission_card import create_mission_card
from .event_card import create_event_card
from .utils import get_text_size

# Font paths
FONTS_DIR = "fonts"
EUROSTILE_BOLD = os.path.join(FONTS_DIR, "Eurostile Extended Bold.ttf")
TITILLIUM_SEMIBOLD = os.path.join(FONTS_DIR, "TitilliumWeb-SemiBold.ttf")
TITILLIUM_REGULAR = os.path.join(FONTS_DIR, "TitilliumWeb-Regular.ttf")

def load_fonts(title_font_size, subtitle_font_size, description_font_size, ability_font_size, single_use_font_size):
    """Load fonts with specified sizes."""
    try:
        title_font = ImageFont.truetype(EUROSTILE_BOLD, title_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        title_font = ImageFont.load_default()
    
    try:
        subtitle_font = ImageFont.truetype(EUROSTILE_BOLD, subtitle_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        subtitle_font = ImageFont.load_default()
    
    try:
        description_font = ImageFont.truetype(TITILLIUM_SEMIBOLD, description_font_size)
    except IOError:
        print(f"Warning: Could not load {TITILLIUM_SEMIBOLD}, falling back to default font")
        description_font = ImageFont.load_default()
    
    try:
        ability_font = ImageFont.truetype(TITILLIUM_SEMIBOLD, ability_font_size)
    except IOError:
        print(f"Warning: Could not load {TITILLIUM_SEMIBOLD}, falling back to default font")
        ability_font = ImageFont.load_default()
    
    try:
        single_use_font = ImageFont.truetype(EUROSTILE_BOLD, single_use_font_size)
    except IOError:
        print(f"Warning: Could not load {EUROSTILE_BOLD}, falling back to default font")
        single_use_font = ImageFont.load_default()
    
    return title_font, subtitle_font, description_font, ability_font, single_use_font


def create_card_sheet(
    cards_data,
    card_type,
    output_path,
    card_width_inches,
    card_height_inches,
    dpi,
    rows,
    columns,
    margin_px,
    show_borders,
    border_width,
    character_image_height_ratio,
    character_image_vertical_position,
    mission_image_height_ratio,
    mission_image_vertical_position,
    event_image_height_ratio,
    event_image_vertical_position,
    title_font_size,
    subtitle_font_size,
    description_font_size,
    ability_font_size,
    single_use_font_size,
    card_margin,
    title_to_image_spacing,
    image_to_content_spacing,
    content_to_traits_spacing,
    traits_area_height,
    single_use_rectangle_padding,
    single_use_grey_color
):
    """Create a sheet with cards arranged in a grid."""
    
    # Calculate pixel dimensions
    card_width_px = int(round(card_width_inches * dpi))
    card_height_px = int(round(card_height_inches * dpi))
    
    # Sheet dimensions
    sheet_width_px = (columns * card_width_px) + ((columns + 1) * margin_px)
    sheet_height_px = (rows * card_height_px) + ((rows + 1) * margin_px)
    cards_per_sheet = rows * columns
    
    # Load fonts
    title_font, subtitle_font, description_font, ability_font, single_use_font = load_fonts(
        title_font_size, subtitle_font_size, description_font_size, 
        ability_font_size, single_use_font_size
    )
    
    # Determine image parameters based on card type
    if card_type == 'characters':
        image_height_ratio = character_image_height_ratio
        image_vertical_position = character_image_vertical_position
    elif card_type == 'missions':
        image_height_ratio = mission_image_height_ratio
        image_vertical_position = mission_image_vertical_position
    elif card_type == 'events':
        image_height_ratio = event_image_height_ratio
        image_vertical_position = event_image_vertical_position
    else:
        image_height_ratio = 0.30
        image_vertical_position = 0.15
    
    # Process cards in batches
    card_index = 0
    sheet_number = 1
    
    while card_index < len(cards_data):
        # Create a new sheet for this batch
        current_sheet = Image.new("RGB", (sheet_width_px, sheet_height_px), "white")
        
        # Fill the sheet with cards
        for row in range(rows):
            for col in range(columns):
                if card_index >= len(cards_data):
                    break
                
                card_data = cards_data[card_index]
                print("Generating card with data: ", card_data)
                
                # Create card based on type
                if card_type == 'characters':
                    card_img = create_character_card(
                        card_data, card_width_px, card_height_px,
                        title_font, subtitle_font, description_font, ability_font, single_use_font,
                        image_height_ratio, image_vertical_position,
                        card_margin, title_to_image_spacing, image_to_content_spacing,
                        content_to_traits_spacing, traits_area_height,
                        single_use_rectangle_padding, single_use_grey_color,
                        show_borders, border_width
                    )
                elif card_type == 'missions':
                    card_img = create_mission_card(
                        card_data, card_width_px, card_height_px,
                        title_font, subtitle_font, description_font,
                        image_height_ratio, image_vertical_position,
                        card_margin, title_to_image_spacing, image_to_content_spacing,
                        content_to_traits_spacing, traits_area_height,
                        show_borders, border_width
                    )
                elif card_type == 'events':
                    card_img = create_event_card(
                        card_data, card_width_px, card_height_px,
                        title_font, subtitle_font, description_font,
                        image_height_ratio, image_vertical_position,
                        card_margin, title_to_image_spacing, image_to_content_spacing,
                        content_to_traits_spacing, traits_area_height,
                        show_borders, border_width
                    )
                else:
                    raise ValueError(f"Unknown card type: {card_type}")
                
                # Calculate position on sheet
                card_x = margin_px + (col * (card_width_px + margin_px))
                card_y = margin_px + (row * (card_height_px + margin_px))
                
                # Paste card onto sheet
                current_sheet.paste(card_img, (card_x, card_y))
                
                card_index += 1
            
            if card_index >= len(cards_data):
                break
        
        # Save this sheet
        if len(cards_data) <= cards_per_sheet:
            # Single sheet, use the original output path
            current_sheet.save(output_path)
            print(f"Saved card sheet to: {output_path}")
        else:
            # Multiple sheets, append sheet number
            base_path = os.path.splitext(output_path)[0]
            ext = os.path.splitext(output_path)[1]
            sheet_path = f"{base_path}_sheet{sheet_number}{ext}"
            current_sheet.save(sheet_path)
            print(f"Saved card sheet {sheet_number} to: {sheet_path}")
            sheet_number += 1

