class ShipBuilder {
    constructor() {
        this.templates = {};
        this.currentShip = this.getDefaultShip();
        this.init();
    }

    getDefaultShip() {
        return {
            title: "My Ship",
            subtitle: "Custom Ship",
            overdrive: [3, 3, 2],
            control: 3,
            shields: {
                front: [2, 2, 2],
                rear: [2, 2]
            },
            reactor: null,
            mess: null,
            sections: {
                left: [],
                core: [],
                right: []
            }
        };
    }

    async init() {
        await this.loadTemplates();
        this.setupEventListeners();
        this.populateDropdowns();
        this.updateUI();
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            this.templates = await response.json();
        } catch (error) {
            console.error('Failed to load templates:', error);
        }
    }

    setupEventListeners() {
        // Ship info
        document.getElementById('shipTitle').addEventListener('input', (e) => {
            this.currentShip.title = e.target.value;
        });

        document.getElementById('shipSubtitle').addEventListener('input', (e) => {
            this.currentShip.subtitle = e.target.value;
        });

        document.getElementById('shipControl').addEventListener('input', (e) => {
            this.currentShip.control = parseInt(e.target.value);
        });

        // Core systems
        document.getElementById('reactorSelect').addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            this.currentShip.reactor = index >= 0 ? this.templates.reactors.reactors[index] : null;
        });

        document.getElementById('messSelect').addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            this.currentShip.mess = index >= 0 ? this.templates.mess_halls.mess_halls[index] : null;
        });

        // Overdrive tokens
        document.getElementById('addOverdrive').addEventListener('click', () => {
            this.currentShip.overdrive.push(3);
            this.updateOverdriveUI();
        });

        document.getElementById('removeOverdrive').addEventListener('click', () => {
            if (this.currentShip.overdrive.length > 1) {
                this.currentShip.overdrive.pop();
                this.updateOverdriveUI();
            }
        });

        // System management
        document.getElementById('addLeftSystem').addEventListener('click', () => {
            this.addSystem('left');
        });

        document.getElementById('addCoreSystem').addEventListener('click', () => {
            this.addSystem('core');
        });

        document.getElementById('addRightSystem').addEventListener('click', () => {
            this.addSystem('right');
        });

        // Main actions
        document.getElementById('generateShip').addEventListener('click', () => {
            this.generateShip();
        });

        document.getElementById('saveShip').addEventListener('click', () => {
            this.saveShip();
        });

        document.getElementById('loadShip').addEventListener('click', () => {
            this.showLoadDialog();
        });
    }

    populateDropdowns() {
        // Populate core system dropdowns
        this.populateSelect('reactorSelect', this.templates.reactors?.reactors || []);
        this.populateSelect('messSelect', this.templates.mess_halls?.mess_halls || []);
        this.populateSelect('engineSelect', this.templates.engines?.engines || []);
        this.populateSelect('bridgeSelect', this.templates.bridges?.bridges || []);

        // Populate system dropdowns
        const allSystems = [
            ...(this.templates.systems?.weapons || []).map(s => ({...s, category: 'weapon'})),
            ...(this.templates.systems?.support || []).map(s => ({...s, category: 'support'})),
            ...(this.templates.systems?.utility || []).map(s => ({...s, category: 'utility'})),
            ...(this.templates.engines?.engines || []).map(s => ({...s, category: 'engine'})),
            ...(this.templates.bridges?.bridges || []).map(s => ({...s, category: 'bridge'}))
        ];

        this.populateSystemSelect('leftSystemSelect', allSystems);
        this.populateSystemSelect('coreSystemSelect', allSystems);
        this.populateSystemSelect('rightSystemSelect', allSystems);
    }

    populateSelect(selectId, items) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select...</option>';
        
        items.forEach((item, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    populateSystemSelect(selectId, systems) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Add System</option>';
        
        systems.forEach((system, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${system.name} (${system.category})`;
            option.dataset.system = JSON.stringify(system);
            select.appendChild(option);
        });
    }

    addSystem(section) {
        const selectId = `${section}SystemSelect`;
        const select = document.getElementById(selectId);
        const selectedOption = select.options[select.selectedIndex];
        
        if (selectedOption.value) {
            const system = JSON.parse(selectedOption.dataset.system);
            this.currentShip.sections[section].push(system);
            this.updateSystemList(section);
            select.selectedIndex = 0;
        }
    }

    removeSystem(section, index) {
        this.currentShip.sections[section].splice(index, 1);
        this.updateSystemList(section);
    }

    updateSystemList(section) {
        const listId = `${section}Systems`;
        const list = document.getElementById(listId);
        list.innerHTML = '';

        this.currentShip.sections[section].forEach((system, index) => {
            const li = document.createElement('li');
            li.className = 'system-item';
            li.innerHTML = `
                <div>
                    <div class="system-name">${system.name}</div>
                    <div class="system-rules">${system.rules || ''}</div>
                </div>
                <button class="btn btn-small btn-danger" onclick="shipBuilder.removeSystem('${section}', ${index})">Remove</button>
            `;
            list.appendChild(li);
        });
    }

    updateOverdriveUI() {
        const container = document.getElementById('overdriveTokens');
        container.innerHTML = '';

        this.currentShip.overdrive.forEach((value, index) => {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '5';
            input.value = value;
            input.className = 'overdrive-token';
            input.addEventListener('input', (e) => {
                this.currentShip.overdrive[index] = parseInt(e.target.value) || 0;
            });
            container.appendChild(input);
        });
    }

    updateUI() {
        // Update form fields
        document.getElementById('shipTitle').value = this.currentShip.title;
        document.getElementById('shipSubtitle').value = this.currentShip.subtitle;
        document.getElementById('shipControl').value = this.currentShip.control;

        // Update overdrive tokens
        this.updateOverdriveUI();

        // Update shield inputs
        this.updateShieldInputs('front', this.currentShip.shields.front);
        this.updateShieldInputs('rear', this.currentShip.shields.rear);

        // Update system lists
        this.updateSystemList('left');
        this.updateSystemList('core');
        this.updateSystemList('right');
    }

    updateShieldInputs(type, shields) {
        const container = document.getElementById(`${type}Shields`);
        container.innerHTML = '';

        shields.forEach((value, index) => {
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = '3';
            input.value = value;
            input.className = 'shield-input';
            input.addEventListener('input', (e) => {
                this.currentShip.shields[type][index] = parseInt(e.target.value) || 0;
            });
            container.appendChild(input);
        });
    }

    async generateShip() {
        const button = document.getElementById('generateShip');
        const previewArea = document.getElementById('previewArea');
        
        button.disabled = true;
        button.textContent = 'Generating...';
        
        try {
            // Prepare ship data
            const shipData = {...this.currentShip};
            
            // Add engine and bridge to core section if selected
            const engineSelect = document.getElementById('engineSelect');
            const bridgeSelect = document.getElementById('bridgeSelect');
            
            if (engineSelect.value) {
                const engine = this.templates.engines.engines[parseInt(engineSelect.value)];
                shipData.sections.core.push(engine);
            }
            
            if (bridgeSelect.value) {
                const bridge = this.templates.bridges.bridges[parseInt(bridgeSelect.value)];
                shipData.sections.core.push(bridge);
            }

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shipData)
            });

            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                
                previewArea.innerHTML = `<img src="${imageUrl}" alt="Generated Ship Sheet">`;
                document.getElementById('downloadSheet').style.display = 'block';
                document.getElementById('downloadSheet').onclick = () => {
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = `${this.currentShip.title.replace(/\s+/g, '_')}.jpg`;
                    a.click();
                };
            } else {
                const error = await response.json();
                previewArea.innerHTML = `<div class="error">Error: ${error.error}</div>`;
            }
        } catch (error) {
            previewArea.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        } finally {
            button.disabled = false;
            button.textContent = 'Generate Ship Sheet';
        }
    }

    async saveShip() {
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.currentShip)
            });

            const result = await response.json();
            
            if (response.ok) {
                alert(`Ship saved successfully: ${result.filename}`);
            } else {
                alert(`Error saving ship: ${result.error}`);
            }
        } catch (error) {
            alert(`Error saving ship: ${error.message}`);
        }
    }

    async showLoadDialog() {
        try {
            const response = await fetch('/api/ships');
            const ships = await response.json();
            
            if (ships.length === 0) {
                alert('No saved ships found');
                return;
            }

            const shipName = prompt(`Available ships:\n${ships.join('\n')}\n\nEnter ship name to load:`);
            
            if (shipName && ships.includes(shipName)) {
                await this.loadShip(shipName);
            }
        } catch (error) {
            alert(`Error loading ships: ${error.message}`);
        }
    }

    async loadShip(shipName) {
        try {
            const response = await fetch(`/api/load/${shipName}`);
            
            if (response.ok) {
                this.currentShip = await response.json();
                this.updateUI();
                alert('Ship loaded successfully');
            } else {
                const error = await response.json();
                alert(`Error loading ship: ${error.error}`);
            }
        } catch (error) {
            alert(`Error loading ship: ${error.message}`);
        }
    }
}

// Global functions for shield management
function addShield(type) {
    shipBuilder.currentShip.shields[type].push(0);
    shipBuilder.updateShieldInputs(type, shipBuilder.currentShip.shields[type]);
}

function removeShield(type) {
    if (shipBuilder.currentShip.shields[type].length > 1) {
        shipBuilder.currentShip.shields[type].pop();
        shipBuilder.updateShieldInputs(type, shipBuilder.currentShip.shields[type]);
    }
}

// Initialize the app
let shipBuilder;
document.addEventListener('DOMContentLoaded', () => {
    shipBuilder = new ShipBuilder();
});
