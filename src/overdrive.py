from PIL import Image, ImageDraw, ImageFont

def get_text_size(draw, text, font):
    """Calculate the size of text with the given font."""
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def render_overdrive_tokens(draw, ship_data, title_y, stats_font, label_font, box_margin):
    """Render the overdrive tokens section of the ship sheet."""
    # Draw Overdrive tokens at the left edge
    overdrive_tokens = ship_data.get('overdrive', [])
    if overdrive_tokens:
        square_size = 100  # Size of each overdrive square
        square_margin = 8  # Space between squares
        label_spacing = 10  # Space between label and squares
        
        # Calculate total width needed for all squares
        total_squares_width = len(overdrive_tokens) * square_size + (len(overdrive_tokens) - 1) * square_margin
        
        # Start position for overdrive elements
        overdrive_x = box_margin
        
        # Draw overdrive label
        overdrive_label = "OVERDRIVE"
        overdrive_label_w, overdrive_label_h = get_text_size(draw, overdrive_label, label_font)
        overdrive_label_x = overdrive_x
        overdrive_label_y = title_y  # Align with title
        draw.text((overdrive_label_x, overdrive_label_y), overdrive_label, font=label_font, fill="black")
        
        # Position squares below the label
        overdrive_y = overdrive_label_y + overdrive_label_h + label_spacing
        
        # Draw each overdrive square with its number
        current_x = overdrive_x
        border_width = 6  # Thicker border
        corner_radius = int(square_size * 0.15)  # Rounded corners
        
        for token_value in overdrive_tokens:
            # Draw rounded square border
            draw.rounded_rectangle(
                [(current_x, overdrive_y), 
                 (current_x + square_size, overdrive_y + square_size)],
                radius=corner_radius,
                outline="black",
                width=border_width,
                fill="white"
            )
            
            # Draw number in center of square
            token_text = str(token_value)
            token_w, token_h = get_text_size(draw, token_text, stats_font)
            text_x = current_x + (square_size - token_w) // 2
            text_y = overdrive_y + (square_size - token_h) // 2
            draw.text((text_x, text_y), token_text, font=stats_font, fill="black")
            
            current_x += square_size + square_margin 