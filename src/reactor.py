from PIL import Image

def generate_reactor_content(draw, system, energy_large_img, current_y, vertical_spacing):
    """Generate content for the Reactor system."""
    empty_space_height = 150
    if "circles" in system:
        energy_count = system["circles"]
        symbol_width = energy_large_img.width
        gap = 20
        
        total_width = (energy_count * symbol_width) + ((energy_count - 1) * gap)

        # If the total width is too large, reduce the symbol size by 10px and try again.
        for attempt in range(6):
            if total_width <= (draw._image.width - 20):  # 40px padding
                break
            # Reduce symbol size by 10px
            symbol_width -= 10
            gap -= 3
            total_width = (energy_count * symbol_width) + ((energy_count - 1) * gap)
            print(f"Reactor energy symbols too large, reducing size to {symbol_width}px and gap to {gap} (attempt {attempt + 1}/6)")

        # Create a copy to energy_large_img and rescale it to the new symbol_width
        energy_large_img_copy = energy_large_img.copy()
        energy_large_img_copy = energy_large_img_copy.resize((symbol_width, symbol_width), Image.Resampling.LANCZOS)    
        
        start_x = (draw._image.width - total_width) // 2
        symbol_y = current_y + (empty_space_height - energy_large_img.height) // 2
        
        for i in range(energy_count):
            pos_x = start_x + (i * (symbol_width + gap))
            draw._image.paste(energy_large_img_copy, (pos_x, symbol_y), energy_large_img_copy)
    
    return current_y + empty_space_height + vertical_spacing 