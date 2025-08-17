# Overdrive Ship Builder - Web Application

A web-based ship builder for Full Spectrum Overdrive that provides a visual interface for creating custom ships and generating ship sheets.

## Features

- **Split-panel interface**: Ship configuration on the left, preview on the right
- **Visual ship builder**: Dropdowns and lists for easy system management
- **Real-time editing**: Modify ship parameters with immediate feedback
- **System templates**: Pre-configured systems for weapons, support, and utility
- **Ship sheet generation**: Create high-quality JPG ship sheets
- **Save/Load functionality**: Store and retrieve ship configurations
- **Template system**: JSON-based system definitions for easy customization

## Quick Start

1. **Install dependencies**:
   ```bash
   pip install -r requirements_web.txt
   ```

2. **Run the web application**:
   ```bash
   python web_app.py
   ```

3. **Open your browser** and navigate to `http://localhost:5000`

## Usage

### Building a Ship

1. **Ship Information**: Enter ship name, subtitle, and control value
2. **Core Systems**: Select reactor, mess hall, engine, and bridge from dropdowns
3. **Overdrive Tokens**: Add/remove tokens and set their values
4. **Shields**: Configure front and rear shield arrays
5. **Ship Sections**: Add systems to left, core, and right sections using dropdowns

### System Management

- **Add Systems**: Select from categorized dropdowns (weapons, support, utility, etc.)
- **Remove Systems**: Click "Remove" button next to any system in the lists
- **System Categories**:
  - **Weapons**: Point Defence, Broadside, Flak Battery
  - **Support**: Control Station, Advanced Sensors, Jammer
  - **Utility**: Living Quarters, Barracks
  - **Core**: Engines and Bridges can be added to any section

### Generating Ship Sheets

1. Configure your ship using the left panel
2. Click "Generate Ship Sheet" button
3. Preview appears in the right panel
4. Use "Download Sheet" to save the JPG file

### Save/Load Ships

- **Save**: Click "Save Ship" to store current configuration as JSON
- **Load**: Click "Load Ship" and select from available saved ships
- Ships are saved in the `ships/` directory

## File Structure

```
├── web_app.py              # Flask application
├── templates/
│   └── index.html          # Main web interface
├── static/
│   ├── css/style.css       # Styling
│   └── js/app.js          # Frontend JavaScript
├── web_templates/          # System template JSON files
│   ├── reactors.json       # Reactor configurations
│   ├── mess_halls.json     # Mess hall configurations
│   ├── engines.json        # Engine configurations
│   ├── bridges.json        # Bridge configurations
│   └── systems.json        # Weapons, support, and utility systems
└── ships/                  # Saved ship configurations
```

## System Templates

The web application uses JSON templates to define available systems:

- **Reactors**: Energy production and damage tracking
- **Mess Halls**: Crew capacity and medical facilities
- **Engines**: Speed and maneuverability options
- **Bridges**: Command and control systems
- **Systems**: Weapons, support systems, and utility modules

### Adding New Systems

1. Edit the appropriate JSON file in `web_templates/`
2. Follow the existing structure for consistency
3. Restart the web application to load new templates

### Example System Definition

```json
{
  "name": "Point Defence Guns",
  "rules": "Anti-Light",
  "areas": [
    {
      "name": "",
      "description": "fast",
      "shoot": {
        "damage": 4,
        "range": "0-1",
        "arc-start": 0,
        "arc-end": 5
      },
      "cost": {
        "energy": 2,
        "crew": 1
      }
    }
  ],
  "electronics": false,
  "hull": true,
  "life_support": true
}
```

## API Endpoints

- `GET /` - Main web interface
- `GET /api/templates` - Get all system templates
- `POST /api/generate` - Generate ship sheet from JSON
- `POST /api/save` - Save ship configuration
- `GET /api/load/<ship_name>` - Load ship configuration
- `GET /api/ships` - List all saved ships

## Development

The web application reuses the existing ship generation code from the original `ship_creator.py`, ensuring consistency between the CLI and web versions.

### Architecture

- **Backend**: Flask web server with API endpoints
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Generation**: Reuses existing PIL-based ship sheet creation
- **Templates**: JSON-based system definitions for flexibility

### Customization

- Modify `static/css/style.css` for visual changes
- Edit `static/js/app.js` for functionality changes
- Update `web_templates/*.json` for new systems
- Extend `web_app.py` for new API endpoints

## Troubleshooting

- **Import errors**: Ensure all dependencies are installed with `pip install -r requirements_web.txt`
- **Template errors**: Check JSON syntax in `web_templates/` files
- **Generation errors**: Verify `fonts/` and `resources/` directories are present
- **Port conflicts**: Change port in `web_app.py` if 5000 is in use

The web application provides a user-friendly interface for the powerful ship generation system while maintaining full compatibility with the existing codebase.
