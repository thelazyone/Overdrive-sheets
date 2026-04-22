#!/usr/bin/env python3
"""
Standalone version of the Overdrive Ship Sheet Generator.
This script provides a drag-and-drop interface and imports the main functionality.
"""

import json
import sys
import os
import time
import traceback
from pathlib import Path

# Add parent directory to path to import ship_creator functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    return os.path.join(base_path, relative_path)

def setup_resource_paths():
    """Set up resource path handling for bundled execution."""
    from PIL import Image
    import system
    
    # Store original Image.open for system.py to use
    original_image_open = Image.open
    
    def patched_image_open(path):
        if isinstance(path, str) and not os.path.isabs(path):
            path = get_resource_path(path)
        return original_image_open(path)
    
    # Apply the patch for system.py calls
    Image.open = patched_image_open
    
    # Also patch system.py font constants to use bundled paths
    original_fonts = {
        'EUROSTILE_BOLD': system.EUROSTILE_BOLD,
        'TITILLIUM_SEMIBOLD': system.TITILLIUM_SEMIBOLD,
        'TITILLIUM_REGULAR': system.TITILLIUM_REGULAR
    }
    
    system.EUROSTILE_BOLD = get_resource_path("fonts/Eurostile Extended Bold.ttf")
    system.TITILLIUM_SEMIBOLD = get_resource_path("fonts/TitilliumWeb-SemiBold.ttf")
    system.TITILLIUM_REGULAR = get_resource_path("fonts/TitilliumWeb-Regular.ttf")
    
    return original_image_open, original_fonts

def restore_resource_paths(original_image_open, original_fonts):
    """Restore original resource paths."""
    from PIL import Image
    import system
    
    Image.open = original_image_open
    
    # Restore original font paths
    system.EUROSTILE_BOLD = original_fonts['EUROSTILE_BOLD']
    system.TITILLIUM_SEMIBOLD = original_fonts['TITILLIUM_SEMIBOLD']
    system.TITILLIUM_REGULAR = original_fonts['TITILLIUM_REGULAR']

def wait_for_key():
    """Wait for user to press any key before exiting."""
    print("\nPress any key to exit...")
    sys.stdout.flush()  # Ensure output is visible
    
    try:
        # First try Windows-specific method
        import msvcrt
        # Give a small delay to ensure text is visible
        time.sleep(0.5)
        msvcrt.getch()
    except ImportError:
        # For non-Windows systems, use input()
        try:
            input()
        except (EOFError, KeyboardInterrupt):
            # If input fails, wait a bit so user can see output
            time.sleep(3)
    except (OSError, Exception):
        # If getch fails (common in drag-and-drop scenarios), try input()
        try:
            input()
        except:
            # Last resort: just wait 5 seconds
            print("Waiting 5 seconds before closing...")
            sys.stdout.flush()
            time.sleep(5)

def check_dependencies():
    """Check if all required dependencies are available."""
    missing_deps = []
    
    try:
        import PIL
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as e:
        missing_deps.append(f"PIL/Pillow: {e}")
    
    try:
        import svglib
        from svglib.svglib import svg2rlg
    except ImportError as e:
        missing_deps.append(f"svglib: {e}")
    
    try:
        import reportlab
        from reportlab.graphics import renderPM
    except ImportError as e:
        missing_deps.append(f"reportlab: {e}")
    
    if missing_deps:
        print("✗ MISSING DEPENDENCIES:")
        for dep in missing_deps:
            print(f"   - {dep}")
        print("\nThis usually means the executable wasn't built correctly.")
        print("Please rebuild the executable with the updated build script.")
        return False
    
    return True

def import_profile():
    """Import ship_profile with better error handling."""
    try:
        import ship_profile
        return ship_profile.create_ship_sheet
    except ImportError as e:
        print(f"✗ Failed to import ship_profile: {e}")
        print("✗ Make sure ship_profile.py is in the same directory or properly bundled.")
        return None
    except Exception as e:
        print(f"✗ Error importing ship_profile: {e}")
        print(f"✗ Full error: {traceback.format_exc()}")
        return None

def process_ship_files():
    """Main processing logic separated from main() for better error handling."""
    # Check dependencies first
    if not check_dependencies():
        return False
    
    # Import profile module
    create_ship_sheet = import_profile()
    if not create_ship_sheet:
        return False
    
    # Set up resource path handling
    original_image_open, original_fonts = setup_resource_paths()
    
    try:
        # Get command line arguments (dropped files)
        dropped_files = sys.argv[1:] if len(sys.argv) > 1 else []
        
        # Filter for JSON files only
        json_files = [f for f in dropped_files if f.lower().endswith('.json') and os.path.exists(f)]
        
        if json_files:
            print(f"Processing {len(json_files)} dropped file(s)...")
            print()
            
            for json_path in json_files:
                try:
                    print(f"Processing: {os.path.basename(json_path)}")
                    
                    # Load ship data
                    with open(json_path, "r", encoding='utf-8') as f:
                        ship_data = json.load(f)
                    
                    # Create output filename in the same directory as the JSON file
                    ship_name = ship_data["title"].lower().replace(" ", "_")
                    output_dir = os.path.dirname(json_path)
                    output_path = os.path.join(output_dir, f"{ship_name}.jpg")
                    
                    # Generate the ship sheet using profile.py with resource resolver
                    create_ship_sheet(ship_data, output_path, get_resource_path)
                    print(f"✓ Ship sheet generated: {output_path}")
                    
                except Exception as e:
                    print(f"✗ Error processing {os.path.basename(json_path)}: {str(e)}")
                    print(f"✗ Full error details: {traceback.format_exc()}")
                    
        else:
            # No files dropped, check ships directory
            ships_dir = "ships"
            if not os.path.exists(ships_dir):
                print("No files were dropped and no 'ships' directory found.")
                print("To use this tool:")
                print("1. Drag and drop .json files onto this executable, OR")
                print("2. Place .json files in a 'ships' folder next to this executable")
            else:
                # Find all JSON files in the ships directory
                ship_json_files = [f for f in os.listdir(ships_dir) if f.endswith('.json')]
                
                if not ship_json_files:
                    print(f"No JSON files found in the '{ships_dir}' directory")
                else:
                    print(f"Processing {len(ship_json_files)} file(s) from '{ships_dir}' directory...")
                    print()
                    
                    # Process each JSON file
                    for json_file in ship_json_files:
                        json_path = os.path.join(ships_dir, json_file)
                        try:
                            print(f"Processing: {json_file}")
                            
                            # Load ship data
                            with open(json_path, "r", encoding='utf-8') as f:
                                ship_data = json.load(f)
                            
                            # Create the ship sheet with ship name in filename
                            ship_name = ship_data["title"].lower().replace(" ", "_")
                            output_path = os.path.join(ships_dir, f"{ship_name}.jpg")
                            create_ship_sheet(ship_data, output_path, get_resource_path)
                            print(f"✓ Ship sheet generated: {output_path}")
                            
                        except Exception as e:
                            print(f"✗ Error processing {json_file}: {str(e)}")
                            print(f"✗ Full error details: {traceback.format_exc()}")
        
        return True
        
    finally:
        # Always restore original paths
        restore_resource_paths(original_image_open, original_fonts)

def main():
    """Main function that handles drag-and-drop files or processes files in ships directory."""
    try:
        print("=" * 60)
        print("         OVERDRIVE SHIP SHEET GENERATOR")
        print("=" * 60)
        print()
        
        success = process_ship_files()
        
        print()
        if success:
            print("Generation complete!")
        else:
            print("Generation failed due to errors above.")
        
    except Exception as e:
        print(f"\n✗ CRITICAL ERROR: {str(e)}")
        print(f"✗ Full error details: {traceback.format_exc()}")
        print("\nPlease report this error with the details above.")
    
    finally:
        # Always wait for input, no matter what happens
        wait_for_key()

if __name__ == "__main__":
    main() 