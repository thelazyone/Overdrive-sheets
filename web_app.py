from flask import Flask, render_template, request, jsonify, send_file
import json
import os
import tempfile
from datetime import datetime
from src.ship_profile import create_ship_sheet

app = Flask(__name__)

# Load system templates
def load_templates():
    templates = {}
    template_files = ['reactors.json', 'mess_halls.json', 'engines.json', 'bridges.json', 'systems.json']
    
    for file in template_files:
        try:
            with open(f'web_templates/{file}', 'r', encoding='utf-8') as f:
                key = file.replace('.json', '')
                templates[key] = json.load(f)
        except FileNotFoundError:
            print(f"Warning: Template file {file} not found")
            templates[key] = {}
    
    return templates

@app.route('/')
def index():
    """Main page with ship builder interface"""
    return render_template('index.html')

@app.route('/api/templates')
def get_templates():
    """Get all system templates for the frontend"""
    templates = load_templates()
    return jsonify(templates)

@app.route('/api/generate', methods=['POST'])
def generate_ship():
    """Generate ship sheet from JSON data"""
    try:
        ship_data = request.json
        
        # Validate required fields
        if not ship_data.get('title'):
            return jsonify({'error': 'Ship title is required'}), 400
        
        # Create temporary file for the generated image
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            output_path = tmp_file.name
        
        # Generate the ship sheet
        create_ship_sheet(ship_data, output_path)
        
        # Return the file
        return send_file(output_path, as_attachment=False, mimetype='image/jpeg')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save', methods=['POST'])
def save_ship():
    """Save ship configuration as JSON file"""
    try:
        ship_data = request.json
        ship_name = ship_data.get('title', 'unnamed_ship').lower().replace(' ', '_')
        
        # Save to ships directory
        os.makedirs('ships', exist_ok=True)
        filename = f'ships/{ship_name}.json'
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(ship_data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'message': f'Ship saved as {filename}', 'filename': filename})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/load/<ship_name>')
def load_ship(ship_name):
    """Load existing ship configuration"""
    try:
        filename = f'ships/{ship_name}.json'
        
        if not os.path.exists(filename):
            return jsonify({'error': 'Ship not found'}), 404
        
        with open(filename, 'r', encoding='utf-8') as f:
            ship_data = json.load(f)
        
        return jsonify(ship_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ships')
def list_ships():
    """List all available ship files"""
    try:
        ships_dir = 'ships'
        if not os.path.exists(ships_dir):
            return jsonify([])
        
        ships = []
        for filename in os.listdir(ships_dir):
            if filename.endswith('.json'):
                ship_name = filename[:-5]  # Remove .json extension
                ships.append(ship_name)
        
        return jsonify(ships)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
