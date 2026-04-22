from PIL import Image, ImageDraw, ImageFont
from .attack_symbols import draw_engine_symbol

def generate_engine_content(draw, system, tile_width_px, current_y, vertical_spacing, area_title_font, combat_number_font):
    """Generate content for the Engine system with speed slots."""
    # Get speed slots from the system data
    speed_slots = system.get("speed_slots", [
        {"speed": "0-1", "rotation": "90°"},
        {"speed": "1-2", "rotation": "45°"}, 
        {"speed": "2-3", "rotation": "0°"}
    ])
    
    # Load shield slot image (we'll use empty shield slots for engine slots)
    engine_slot_img = Image.open("resources/engine_slot.png")
    
    # Resize to bigger size for engine slots
    slot_size = 200 
    shield_slot_img = engine_slot_img.resize((slot_size, slot_size), Image.Resampling.LANCZOS)
    
    # Calculate layout
    slot_spacing = 40 
    total_slots_width = (len(speed_slots) * slot_size) + ((len(speed_slots) - 1) * slot_spacing)
    
    # Center the slots horizontally
    start_x = (tile_width_px - total_slots_width) // 2
    slot_y = current_y + 15
    
    # Draw each speed slot
    for i, slot in enumerate(speed_slots):
        slot_x = start_x + (i * (slot_size + slot_spacing))
        
        # Draw the empty slot
        draw._image.paste(shield_slot_img, (slot_x, slot_y), shield_slot_img)
        
        # Draw engine symbol with speed and rotation inside the slot
        speed_text = slot["speed"]
        rotation_text = slot["rotation"]
        engine_img = draw_engine_symbol(draw, 0, 0, 150, speed_text, combat_number_font, rotation_text)
        
        # Center the engine symbol in the slot
        symbol_x = slot_x + (slot_size - engine_img.width) // 2
        symbol_y = slot_y + (slot_size - engine_img.height) // 2
        draw._image.paste(engine_img, (symbol_x, symbol_y), engine_img)
    
    # Calculate total height used (slot size plus some padding)
    total_height = slot_size
    
    return current_y + total_height + vertical_spacing 