import json
import os
import argparse
from src.ship_profile import create_ship_sheet
from src.migrate import migrate_ship

# The Python tool is now rooted at <repo>/python/. Shared assets (fonts,
# resources) still live at <repo>/..  (the Pillow/system.py code uses
# relative paths like "fonts/..."), so we chdir to the repo root for the
# duration of generation so those references keep resolving.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)


def _load_and_migrate(json_path: str) -> dict:
    """Load a ship JSON and normalize it to the legacy renderer shape."""
    with open(json_path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return migrate_ship(raw, repo_root=REPO_ROOT)


def main():
    parser = argparse.ArgumentParser(description="Generate ship sheets from JSON files.")
    parser.add_argument(
        "-s",
        "--ship",
        help="Generate a specific ship by providing its JSON file path (e.g., python/ships/my_ship.json)",
    )
    args = parser.parse_args()

    # Resolve the user-supplied ship path against the original cwd before we
    # chdir to the repo root, so paths like `.\ships\foo.json` (run from
    # `python/`) still point at the right file.
    ship_abspath = os.path.abspath(args.ship) if args.ship else None

    os.chdir(REPO_ROOT)

    ships_dir = os.path.join("python", "ships")
    if not os.path.exists(ships_dir):
        os.makedirs(ships_dir)

    if args.ship:
        json_path = ship_abspath
        if not os.path.exists(json_path):
            print(f"Error: Ship file not found: {json_path}")
            return

        try:
            ship_data = _load_and_migrate(json_path)
            ship_name = ship_data["title"].lower().replace(" ", "_")
            output_path = os.path.join(ships_dir, f"{ship_name}.jpg")
            create_ship_sheet(ship_data, output_path)
        except Exception as e:
            print(f"Error processing {json_path}: {str(e)}")
    else:
        json_files = [f for f in os.listdir(ships_dir) if f.endswith(".json")]

        if not json_files:
            print("No JSON files found in the ships directory")
            return

        for json_file in json_files:
            json_path = os.path.join(ships_dir, json_file)
            try:
                ship_data = _load_and_migrate(json_path)
                ship_name = ship_data["title"].lower().replace(" ", "_")
                output_path = os.path.join(ships_dir, f"{ship_name}.jpg")
                create_ship_sheet(ship_data, output_path)
            except Exception as e:
                print(f"Error processing {json_file}: {str(e)}")


if __name__ == "__main__":
    main()
