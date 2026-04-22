# Overdrive Ship Sheet Generator - Standalone Build

This guide will help you create a standalone executable of the Overdrive Ship Sheet Generator.

## Prerequisites

1. **Python 3.8 or newer** installed on your system
2. All project files (including the parent directory with ship_creator.py, system.py, fonts/, resources/)

## Quick Build Instructions

### Step 1: Navigate to the standalone folder
```bash
cd standalone
```

### Step 2: Install Dependencies
Open a command prompt/terminal in the standalone directory and run:
```bash
pip install -r requirements.txt
```

### Step 3: Build the Executable
Run the build script:
```bash
python build_exe.py
```

The build process will:
- Create a PyInstaller spec file
- Bundle all fonts and resources from the parent directory
- Import the main ship_creator.py functions (no code duplication)
- Generate a single executable file
- Clean up temporary files

### Step 4: Find Your Executable
The finished executable will be located at:
```
standalone/dist/OverdriveShipGenerator.exe
```

## Project Structure

```
your-project/
├── ship_creator.py              # ← Main functionality (reused)
├── system.py                    # ← System generation (reused)
├── fonts/                       # ← Font files (bundled)
├── resources/                   # ← Resource images (bundled)
├── ships/                       # ← Sample JSON files
└── standalone/                  # ← Deployment folder
    ├── ship_generator_standalone.py  # ← Minimal wrapper script
    ├── build_exe.py             # ← Build script
    ├── requirements.txt          # ← Dependencies
    ├── BUILD_README.md          # ← This file
    └── dist/                    # ← Generated executable
        └── OverdriveShipGenerator.exe
```

## Using the Executable

The standalone executable can be used in three ways:

### Method 1: Drag and Drop (Recommended)
- Drag one or more `.json` ship files onto the `OverdriveShipGenerator.exe`
- The tool will generate ship sheets in the same directory as the JSON files
- Press any key when prompted to exit

### Method 2: Ships Folder
- Create a `ships` folder next to the executable
- Place your `.json` ship files in the `ships` folder
- Double-click `OverdriveShipGenerator.exe`
- Generated images will be saved in the `ships` folder

### Method 3: Direct Execution
- Double-click `OverdriveShipGenerator.exe`
- If no files are dropped and no `ships` folder exists, it will show usage instructions

## Advantages of This Approach

- **No Code Duplication**: The standalone script imports and reuses existing functions
- **Easier Maintenance**: Changes to ship_creator.py automatically apply to the executable
- **Clean Organization**: All deployment files are in the standalone folder
- **Smaller Codebase**: The wrapper script is minimal and focused

## Troubleshooting

### Build Issues
- Make sure you're running the build script from the `standalone` folder
- Ensure the parent directory contains ship_creator.py, system.py, fonts/, and resources/
- Check that Python and pip are properly installed
- Ensure you have enough disk space (build requires ~500MB temporarily)

### Runtime Issues
- The executable includes all necessary fonts and resources
- No additional installation is required on the target system
- Works on Windows systems without Python installed

## Technical Details

- **File Size**: Approximately 50-80 MB
- **Dependencies**: All bundled (PIL/Pillow, svglib, reportlab)
- **Platform**: Windows executable (.exe)
- **Compression**: UPX compression enabled for smaller file size
- **Code Reuse**: Imports ship_creator.py functions directly

## Advanced Options

If you need to modify the build process, edit the `build_exe.py` script. Key areas:

- **Icon**: Add `icon='path/to/icon.ico'` in the spec file
- **Console**: Change `console=True` to `console=False` for windowed mode
- **Additional Files**: Add more entries to the `datas` list in the spec file

## Distribution

The generated `OverdriveShipGenerator.exe` is completely standalone and can be:
- Copied to any Windows computer
- Shared without requiring Python installation
- Used offline without internet connection

## Development Workflow

1. Make changes to the main `ship_creator.py` or `system.py` files
2. Test with the regular Python script
3. When ready to deploy, run the build script from the `standalone` folder
4. The new executable will automatically include your latest changes 