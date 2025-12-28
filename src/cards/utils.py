import os
from PIL import Image, ImageDraw, ImageFont

# Font paths
FONTS_DIR = "fonts"
EUROSTILE_BOLD = os.path.join(FONTS_DIR, "Eurostile Extended Bold.ttf")

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def load_trait_icon(trait_name, traits_area_height):
    """Load a trait icon from resources/traits folder, or create a fallback with initial letter."""
    trait_file = os.path.join("resources", "traits", f"{trait_name.lower()}.png")
    
    if os.path.exists(trait_file):
        try:
            icon = Image.open(trait_file)
            # Resize to fit traits area
            icon_size = int(traits_area_height * 0.8)
            icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            return icon
        except:
            pass
    
    # Fallback: create icon with initial letter
    icon_size = int(traits_area_height * 0.8)
    icon = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(icon)
    
    try:
        font = ImageFont.truetype(EUROSTILE_BOLD, int(icon_size * 0.7))
    except IOError:
        font = ImageFont.load_default()
    
    initial = trait_name[0].upper() if trait_name else "?"
    text_w, text_h = get_text_size(draw, initial, font)
    x = (icon_size - text_w) // 2
    y = (icon_size - text_h) // 2
    draw.text((x, y), initial, font=font, fill="black")
    
    return icon

