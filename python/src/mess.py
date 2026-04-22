from PIL import Image, ImageDraw, ImageFont
import os

# Font paths
FONTS_DIR = "fonts"
EUROSTILE_BOLD = os.path.join(FONTS_DIR, "Eurostile Extended Bold.ttf")

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

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