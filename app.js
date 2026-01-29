/* ============================================
   SCARLETT ISLES COMPANION - APP.JS
   ============================================ */

// State
let characters = [];
let currentCharacter = null;

// DOM Elements
const characterSelect = document.getElementById('characterSelect');
const characterSheet = document.getElementById('characterSheet');
const characterGrid = document.getElementById('characterGrid');
const backBtn = document.getElementById('backBtn');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadCharacters();
    renderCharacterSelect();
    setupEventListeners();
}

// ============================================
// DATA LOADING
// ============================================

async function loadCharacters() {
    try {
        const response = await fetch('data/characters.json');
        const data = await response.json();
        characters = data.characters;
    } catch (error) {
        console.error('Failed to load characters:', error);
        characters = [];
    }
}

// ============================================
// CHARACTER SELECT
// ============================================

function renderCharacterSelect() {
    characterGrid.innerHTML = characters.map(char => `
        <div class="character-card" data-id="${char.id}">
            <img src="${char.image}" alt="${char.name}" class="portrait-thumb">
            <div class="char-name">${char.name}</div>
            <div class="char-class">${char.class} ${char.level}</div>
        </div>
    `).join('');
}

function selectCharacter(id) {
    currentCharacter = characters.find(c => c.id === id);
    if (!currentCharacter) return;
    
    renderCharacterSheet();
    showScreen('characterSheet');
}

// ============================================
// CHARACTER SHEET
// ============================================

function renderCharacterSheet() {
    const char = currentCharacter;
    if (!char) return;
    
    // Header
    document.getElementById('charName').textContent = char.name;
    document.getElementById('charClassLevel').textContent = `${char.species} ${char.class} ${char.level}`;
    document.getElementById('charGold').textContent = `${char.currency.gp} gp`;
    
    // Portrait and Combat Stats
    document.getElementById('charPortrait').src = char.image;
    document.getElementById('charHp').textContent = `${char.combat.currentHp}/${char.combat.maxHp}`;
    document.getElementById('charAc').textContent = char.combat.armorClass;
    document.getElementById('charInit').textContent = formatModifier(char.combat.initiative);
    document.getElementById('charSpeed').textContent = char.combat.speed.split(' ')[0];
    
    // Abilities
    renderAbilities();
    
    // Saving Throws
    renderSaves();
    
    // Skills
    renderSkills();
    
    // Features
    renderFeatures();
    
    // Inventory
    renderInventory();
    
    // Spells
    renderSpells();
}

function renderAbilities() {
    const char = currentCharacter;
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const abbrev = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    
    document.getElementById('abilitiesGrid').innerHTML = abilities.map((ability, i) => {
        const stat = char.stats[ability];
        return `
            <div class="ability-box">
                <div class="ability-name">${abbrev[i]}</div>
                <div class="ability-mod">${formatModifier(stat.modifier)}</div>
                <div class="ability-score">${stat.score}</div>
            </div>
        `;
    }).join('');
}

function renderSaves() {
    const char = currentCharacter;
    const saves = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    const names = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    
    document.getElementById('savesGrid').innerHTML = saves.map((save, i) => {
        const data = char.savingThrows[save];
        return `
            <div class="save-item">
                <div class="prof-dot ${data.proficient ? 'proficient' : ''}"></div>
                <span class="save-name">${names[i]}</span>
                <span class="save-mod">${formatModifier(data.modifier)}</span>
            </div>
        `;
    }).join('');
}

function renderSkills() {
    const char = currentCharacter;
    const skillMap = {
        acrobatics: 'Acrobatics',
        animalHandling: 'Animal Handling',
        arcana: 'Arcana',
        athletics: 'Athletics',
        deception: 'Deception',
        history: 'History',
        insight: 'Insight',
        intimidation: 'Intimidation',
        investigation: 'Investigation',
        medicine: 'Medicine',
        nature: 'Nature',
        perception: 'Perception',
        performance: 'Performance',
        persuasion: 'Persuasion',
        religion: 'Religion',
        sleightOfHand: 'Sleight of Hand',
        stealth: 'Stealth',
        survival: 'Survival'
    };
    
    document.getElementById('skillsList').innerHTML = Object.entries(skillMap).map(([key, name]) => {
        const skill = char.skills[key];
        let dotClass = '';
        if (skill.expertise) dotClass = 'expertise';
        else if (skill.proficient) dotClass = 'proficient';
        
        return `
            <div class="skill-item">
                <div class="prof-dot ${dotClass}"></div>
                <span class="skill-name">${name}</span>
                <span class="skill-mod">${formatModifier(skill.modifier)}</span>
            </div>
        `;
    }).join('');
}

function renderFeatures() {
    const char = currentCharacter;
    if (!char.features || char.features.length === 0) {
        document.getElementById('featuresList').innerHTML = '<span class="feature-tag">No features</span>';
        return;
    }
    
    document.getElementById('featuresList').innerHTML = char.features.map(f => 
        `<span class="feature-tag">${f}</span>`
    ).join('');
}

function renderInventory() {
    const char = currentCharacter;
    
    // Currency
    document.getElementById('invGold').textContent = `${char.currency.gp} gp`;
    
    // Calculate total weight
    const totalWeight = char.inventory.reduce((sum, item) => sum + (item.weight * item.qty), 0);
    document.getElementById('invWeight').textContent = `${totalWeight} lb`;
    
    // Items
    document.getElementById('inventoryList').innerHTML = char.inventory.map(item => `
        <div class="inventory-item">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">×${item.qty}</span>
            <span class="item-weight">${item.weight > 0 ? item.weight * item.qty + ' lb' : '—'}</span>
        </div>
    `).join('');
}

function renderSpells() {
    const char = currentCharacter;
    const spellsContent = document.getElementById('spellsContent');
    
    if (!char.spells || (!char.spells.known?.length && !char.spells.cantrips?.length)) {
        spellsContent.innerHTML = '<div class="no-spells">No spellcasting abilities</div>';
        return;
    }
    
    let html = '';
    
    // Spell Stats
    if (char.spells.ability) {
        html += `
            <div class="spell-stats">
                <div class="spell-stat">
                    <div class="label">Ability</div>
                    <div class="value">${char.spells.ability}</div>
                </div>
                ${char.spells.saveDC ? `
                <div class="spell-stat">
                    <div class="label">Save DC</div>
                    <div class="value">${char.spells.saveDC}</div>
                </div>
                ` : ''}
                ${char.spells.attackBonus ? `
                <div class="spell-stat">
                    <div class="label">Attack</div>
                    <div class="value">+${char.spells.attackBonus}</div>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    // Spell Slots
    if (char.spells.slots && Object.keys(char.spells.slots).length > 0) {
        html += `
            <div class="spell-section">
                <h4>Spell Slots</h4>
                ${Object.entries(char.spells.slots).map(([level, count]) => `
                    <div class="spell-item">
                        <span class="spell-name">${level} Level: ${count} slots</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Cantrips
    if (char.spells.cantrips && char.spells.cantrips.length > 0) {
        html += `
            <div class="spell-section">
                <h4>Cantrips</h4>
                ${char.spells.cantrips.map(spell => `
                    <div class="spell-item">
                        <div class="spell-name">${spell.name}</div>
                        ${spell.source ? `<div class="spell-source">${spell.source}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Known/Prepared Spells
    if (char.spells.known && char.spells.known.length > 0) {
        html += `
            <div class="spell-section">
                <h4>Spells</h4>
                ${char.spells.known.map(spell => `
                    <div class="spell-item">
                        <div class="spell-name">${spell.name}${spell.prepared ? ' ★' : ''}${spell.ritual ? ' (R)' : ''}</div>
                        ${spell.source ? `<div class="spell-source">${spell.source}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    spellsContent.innerHTML = html;
}

// ============================================
// NAVIGATION
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function setupEventListeners() {
    // Character selection
    characterGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.character-card');
        if (card) {
            selectCharacter(card.dataset.id);
        }
    });
    
    // Back button
    backBtn.addEventListener('click', () => {
        showScreen('characterSelect');
        currentCharacter = null;
    });
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

// ============================================
// UTILITIES
// ============================================

function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}
