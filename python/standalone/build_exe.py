#!/usr/bin/env python3
"""
Build script for creating the Overdrive Ship Sheet Generator executable.
This script creates a PyInstaller spec file and builds the standalone executable.
"""

import os
import sys
import shutil
from pathlib import Path

def create_spec_file():
    """Create the PyInstaller spec file with all necessary data files."""
    
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['ship_generator_standalone.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../fonts/*.ttf', 'fonts'),
        ('../resources/*.png', 'resources'),
        ('../system.py', '.'),
        ('../ship_profile.py', '.'),
    ],
    hiddenimports=[
        'msvcrt',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw', 
        'PIL.ImageFont',
        'svglib',
        'svglib.svglib',
        'reportlab',
        'reportlab.graphics',
        'reportlab.graphics.renderPM',
        'io',
        'tempfile',
        'math',
        'json',
        'os',
        'sys',
        'time',
        'traceback',
        'pathlib',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='OverdriveShipGenerator',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
    version=None,
)
'''
    
    with open('OverdriveShipGenerator.spec', 'w') as f:
        f.write(spec_content)
    
    print("✓ Created PyInstaller spec file: OverdriveShipGenerator.spec")

def build_executable():
    """Build the executable using PyInstaller."""
    print("Building executable...")
    print("This may take a few minutes...")
    
    # Run PyInstaller
    os.system('pyinstaller --clean OverdriveShipGenerator.spec')
    
    if os.path.exists('dist/OverdriveShipGenerator.exe'):
        print("✓ Executable built successfully!")
        print("✓ Location: dist/OverdriveShipGenerator.exe")
        
        # Calculate file size
        size_bytes = os.path.getsize('dist/OverdriveShipGenerator.exe')
        size_mb = size_bytes / (1024 * 1024)
        print(f"✓ File size: {size_mb:.1f} MB")
        
        return True
    else:
        print("✗ Failed to build executable")
        return False

def cleanup():
    """Clean up build artifacts."""
    print("Cleaning up build artifacts...")
    
    dirs_to_remove = ['build', '__pycache__']
    files_to_remove = ['OverdriveShipGenerator.spec']
    
    for dir_name in dirs_to_remove:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"✓ Removed {dir_name}/")
    
    for file_name in files_to_remove:
        if os.path.exists(file_name):
            os.remove(file_name)
            print(f"✓ Removed {file_name}")

def main():
    """Main build process."""
    print("=" * 60)
    print("    OVERDRIVE SHIP GENERATOR - BUILD SCRIPT")
    print("=" * 60)
    print()
    
    # Check if required files exist (in parent directory)
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    required_files = [
        'ship_generator_standalone.py',  # In current directory
        '../ship_creator.py',
        '../system.py',
        '../fonts',
        '../resources'
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print("✗ Missing required files/directories:")
        for file_path in missing_files:
            print(f"   - {file_path}")
        print()
        print("Please ensure all files are present before building.")
        print("Make sure you're running this from the 'standalone' folder.")
        return False
    
    print("✓ All required files found")
    print()
    
    # Create spec file
    create_spec_file()
    print()
    
    # Build executable
    success = build_executable()
    print()
    
    if success:
        # Cleanup
        cleanup()
        print()
        
        print("=" * 60)
        print("                BUILD COMPLETE!")
        print("=" * 60)
        print()
        print("Your executable is ready at: dist/OverdriveShipGenerator.exe")
        print()
        print("Usage:")
        print("1. Drag and drop .json files onto the executable")
        print("2. Or place .json files in a 'ships' folder next to the .exe")
        print("3. Or double-click the .exe to process all files in 'ships' folder")
        print()
        
        return True
    else:
        print("✗ Build failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 