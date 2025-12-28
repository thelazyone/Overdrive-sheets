# Card Generation System

This system generates card sheets from CSV files. Cards are arranged in a 3×6 grid (18 cards per sheet) at mini poker card size (1.75" × 2.5").

## CSV Files

Three CSV files are supported:
- **Characters.csv** - Character cards with passive and active abilities
- **Missions.csv** - Mission cards with descriptions
- **Events.csv** - Event cards with descriptions

### CSV Format

All CSV files use semicolon (`;`) as the delimiter. Lines starting with `#` or empty lines are ignored.

#### Characters.csv
```
Title;Image path;Passive ability;Active ability;Traits
```

- **Title**: Card title (required)
- **Image path**: Path to image file (optional)
- **Passive ability**: Passive ability text (optional)
- **Active ability**: Active ability text (optional, marked as "SINGLE USE")
- **Traits**: Semicolon-separated list of trait names (optional)

#### Missions.csv / Events.csv
```
Title;Image path;Description;Traits
```

- **Title**: Card title (required)
- **Image path**: Path to image file (optional)
- **Description**: Card description text (optional, supports `\n` for line breaks)
- **Traits**: Semicolon-separated list of trait names (optional)

## Traits

Traits are displayed as icons at the bottom of cards. The system looks for trait icons in `resources/traits/` folder (e.g., `resources/traits/leadership.png`). If an icon is not found, it displays the first letter of the trait name in uppercase.

## Usage

```bash
# Generate all card sheets from all CSV files
python card_creator.py

# Generate from a specific CSV file
python card_creator.py -c cards/Characters.csv

# Specify card type explicitly
python card_creator.py -c cards/Characters.csv --type characters
```

## Configuration

All parameters can be edited in `card_creator.py` at the top of the file:
- Card dimensions
- Image sizes and positions (per card type)
- Font sizes
- Spacing and margins
- Border settings

