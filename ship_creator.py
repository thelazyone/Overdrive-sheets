import json
import os
import argparse
from ship_profile import create_ship_sheet

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate ship sheets from JSON files.')
    parser.add_argument('-s', '--ship', help='Generate a specific ship by providing its JSON file path (e.g., ships/my_ship.json)')
    args = parser.parse_args()

    # Create ships directory if it doesn't exist
    ships_dir = "ships"
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