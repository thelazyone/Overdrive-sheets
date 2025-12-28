import csv
import os
import argparse
from src.cards.card_generator import create_card_sheet

# ============================================================================
# PARAMETERS - Edit these values to customize card generation
# ============================================================================

# Card dimensions (mini poker size)
CARD_WIDTH_INCHES = 1.75
CARD_HEIGHT_INCHES = 2.5
DPI = 300

# Sheet layout
ROWS = 3
COLUMNS = 6
CARDS_PER_SHEET = ROWS * COLUMNS
MARGIN_PX = 20  # Margin around the entire sheet

# Card borders
SHOW_CARD_BORDERS = True
BORDER_WIDTH = 2

# Image parameters (as percentage of card height, 0.0 to 1.0)
CHARACTER_IMAGE_HEIGHT_RATIO = 0.35  # 35% of card height
CHARACTER_IMAGE_VERTICAL_POSITION = 0.15  # 15% from top
MISSION_IMAGE_HEIGHT_RATIO = 0.30  # 30% of card height
MISSION_IMAGE_VERTICAL_POSITION = 0.15  # 15% from top
EVENT_IMAGE_HEIGHT_RATIO = 0.30  # 30% of card height
EVENT_IMAGE_VERTICAL_POSITION = 0.15  # 15% from top

# Font sizes
TITLE_FONT_SIZE = 32
SUBTITLE_FONT_SIZE = 18  # For card type label
DESCRIPTION_FONT_SIZE = 20
ABILITY_FONT_SIZE = 18
SINGLE_USE_FONT_SIZE = 14

# Spacing
CARD_MARGIN = 15  # Internal margin for card content
TITLE_TO_IMAGE_SPACING = 10
IMAGE_TO_CONTENT_SPACING = 15
CONTENT_TO_TRAITS_SPACING = 10
TRAITS_AREA_HEIGHT = 30  # Height for traits icons area

# Single use indicator
SINGLE_USE_RECTANGLE_PADDING = 5
SINGLE_USE_GREY_COLOR = "#E0E0E0"

# ============================================================================

def read_csv_file(csv_path):
    """Read a CSV file and return list of dictionaries, skipping comments and empty lines."""
    cards = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(filter(lambda row: row[0]!='#', f), delimiter=';')
        
        for row in reader:

            # Appending the row since it is valid
            print("Appending row: ", row)
            cards.append(row)
    return cards


def main():
    parser = argparse.ArgumentParser(description='Generate card sheets from CSV files.')
    parser.add_argument('-c', '--csv', help='Generate cards from a specific CSV file (e.g., cards/Characters.csv)')
    parser.add_argument('--type', choices=['characters', 'missions', 'events'], 
                       help='Card type (if not specified, inferred from CSV filename)')
    args = parser.parse_args()

    cards_dir = "cards"
    if not os.path.exists(cards_dir):
        os.makedirs(cards_dir)
    
    # Determine which CSV files to process
    csv_files = []
    if args.csv:
        csv_files.append(args.csv)
    else:
        # Process all three CSV files
        for csv_name in ['Characters.csv', 'Missions.csv', 'Events.csv']:
            csv_path = os.path.join(cards_dir, csv_name)
            if os.path.exists(csv_path):
                csv_files.append(csv_path)
    
    if not csv_files:
        print("No CSV files found. Please create Characters.csv, Missions.csv, or Events.csv in the cards directory.")
        return
    
    # Process each CSV file
    for csv_path in csv_files:
        if not os.path.exists(csv_path):
            print(f"Warning: CSV file not found: {csv_path}")
            continue
        
        try:
            # Determine card type from filename or argument
            filename = os.path.basename(csv_path).lower()
            if args.type:
                card_type = args.type
            elif 'character' in filename:
                card_type = 'characters'
            elif 'mission' in filename:
                card_type = 'missions'
            elif 'event' in filename:
                card_type = 'events'
            else:
                print(f"Warning: Could not determine card type for {csv_path}. Skipping.")
                continue
            
            # Read cards from CSV
            cards_data = read_csv_file(csv_path)
            
            if not cards_data:
                print(f"No valid cards found in {csv_path}")
                continue

            print("Cards data: ", cards_data)
            
            # Generate output filename
            base_name = os.path.splitext(os.path.basename(csv_path))[0]
            output_path = os.path.join(cards_dir, f"{base_name}_sheet.jpg")
            
            # Create card sheet
            create_card_sheet(
                cards_data,
                card_type,
                output_path,
                # Pass all parameters
                card_width_inches=CARD_WIDTH_INCHES,
                card_height_inches=CARD_HEIGHT_INCHES,
                dpi=DPI,
                rows=ROWS,
                columns=COLUMNS,
                margin_px=MARGIN_PX,
                show_borders=SHOW_CARD_BORDERS,
                border_width=BORDER_WIDTH,
                character_image_height_ratio=CHARACTER_IMAGE_HEIGHT_RATIO,
                character_image_vertical_position=CHARACTER_IMAGE_VERTICAL_POSITION,
                mission_image_height_ratio=MISSION_IMAGE_HEIGHT_RATIO,
                mission_image_vertical_position=MISSION_IMAGE_VERTICAL_POSITION,
                event_image_height_ratio=EVENT_IMAGE_HEIGHT_RATIO,
                event_image_vertical_position=EVENT_IMAGE_VERTICAL_POSITION,
                title_font_size=TITLE_FONT_SIZE,
                subtitle_font_size=SUBTITLE_FONT_SIZE,
                description_font_size=DESCRIPTION_FONT_SIZE,
                ability_font_size=ABILITY_FONT_SIZE,
                single_use_font_size=SINGLE_USE_FONT_SIZE,
                card_margin=CARD_MARGIN,
                title_to_image_spacing=TITLE_TO_IMAGE_SPACING,
                image_to_content_spacing=IMAGE_TO_CONTENT_SPACING,
                content_to_traits_spacing=CONTENT_TO_TRAITS_SPACING,
                traits_area_height=TRAITS_AREA_HEIGHT,
                single_use_rectangle_padding=SINGLE_USE_RECTANGLE_PADDING,
                single_use_grey_color=SINGLE_USE_GREY_COLOR
            )
            
        except Exception as e:
            print(f"Error processing {csv_path}: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()

