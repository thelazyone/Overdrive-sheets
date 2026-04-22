import json
import os
import argparse
from src.ship_profile import create_ship_sheet

# The Python tool is now rooted at <repo>/python/. Shared assets (fonts,
# resources) still live at <repo>/..  (the Pillow/system.py code uses
# relative paths like "fonts/..."), so we chdir to the repo root for the
# duration of generation so those references keep resolving.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate ship sheets from JSON files.')
    parser.add_argument('-s', '--ship', help='Generate a specific ship by providing its JSON file path (e.g., ships/my_ship.json)')
    args = parser.parse_args()

    os.chdir(REPO_ROOT)

    # Ships directory now lives next to this script at python/ships/.
    ships_dir = os.path.join("python", "ships")
    if not os.path.exists(ships_dir):
        os.makedirs(ships_dir)
    
    if args.ship:
        # Handle single ship generation
        json_path = args.ship
        if not os.path.exists(json_path):
            print(f"Error: Ship file not found: {json_path}")
            return
        
        try:
            # Load ship data
            with open(json_path, "r", encoding='utf-8') as f:
                ship_data = json.load(f)
            
            # Create the ship sheet with ship name in filename
            ship_name = ship_data["title"].lower().replace(" ", "_")
            output_path = os.path.join(ships_dir, f"{ship_name}.jpg")
            create_ship_sheet(ship_data, output_path)
            
        except Exception as e:
            print(f"Error processing {json_path}: {str(e)}")
    else:
        # Find all JSON files in the ships directory
        json_files = [f for f in os.listdir(ships_dir) if f.endswith('.json')]
        
        if not json_files:
            print("No JSON files found in the ships directory")
            return
        
        # Process each JSON file
        for json_file in json_files:
            json_path = os.path.join(ships_dir, json_file)
            try:
                # Load ship data
                with open(json_path, "r", encoding='utf-8') as f:
                    ship_data = json.load(f)
                
                # Create the ship sheet with ship name in filename
                ship_name = ship_data["title"].lower().replace(" ", "_")
                output_path = os.path.join(ships_dir, f"{ship_name}.jpg")
                create_ship_sheet(ship_data, output_path)
                
            except Exception as e:
                print(f"Error processing {json_file}: {str(e)}")

if __name__ == "__main__":
    main() 