from PIL import Image, ImageDraw

def draw_firing_arc(draw, arc_start, arc_end, size=40):
    """Draw a firing arc circle showing the weapon's firing direction.
    
    Args:
        draw: ImageDraw object (not used directly, for consistency)
        arc_start: Starting position (0-8, where 0 is bottom)
        arc_end: Ending position (0-8, where 0 is bottom)
        size: Size of the circle in pixels
    
    Returns:
        PIL Image with the firing arc visualization
    """
    # Use 4x resolution for antialiasing
    scale_factor = 4
    high_res_size = size * scale_factor
    
    # Create a high-resolution image for the firing arc
    arc_img_hr = Image.new('RGBA', (high_res_size, high_res_size), (255, 255, 255, 0))
    arc_draw_hr = ImageDraw.Draw(arc_img_hr)
    
    # Draw the outer circle at high resolution
    circle_margin = 2 * scale_factor
    line_width = 6 * scale_factor
    arc_draw_hr.ellipse([circle_margin, circle_margin, high_res_size - circle_margin, high_res_size - circle_margin], 
                     outline="black", width=line_width)
    
    # Handle full circle case (0-8 or equivalent)
    if (arc_start == 0 and arc_end == 8) or (arc_end - arc_start == 8) or (arc_start == arc_end):
        # Fill the entire circle
        fill_margin = circle_margin + line_width // 2
        arc_draw_hr.ellipse([fill_margin, fill_margin, high_res_size - fill_margin, high_res_size - fill_margin], 
                         fill="black")
    else:
        # Calculate angles for the arc
        # 0 is bottom (270°), then clockwise: 1=315°, 2=0°, 3=45°, 4=90°, 5=135°, 6=180°, 7=225°, 8=270°
        def position_to_angle(pos):
            # Convert position (0-8) to degrees
            # Position 0 = 270° (bottom), then clockwise
            angle = (90 + pos * 45) % 360
            return angle
        
        start_angle = position_to_angle(arc_start)
        end_angle = position_to_angle(arc_end)
        
        # Handle wrapping around 360°
        if end_angle < start_angle:
            end_angle += 360
        
        # Draw the arc sectors at high resolution
        center_x, center_y = high_res_size // 2, high_res_size // 2
        radius = (high_res_size - circle_margin * 2) // 2 - line_width // 2
        
        # Draw filled arc
        arc_draw_hr.pieslice([center_x - radius, center_y - radius, center_x + radius, center_y + radius],
                          start=start_angle, end=end_angle, fill="black")
    
    # Scale down with high-quality resampling for antialiasing
    arc_img = arc_img_hr.resize((size, size), Image.Resampling.LANCZOS)
    
    return arc_img 