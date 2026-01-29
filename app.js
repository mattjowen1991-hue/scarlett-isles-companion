/* ============================================
   SCARLETT ISLES COMPANION - APP.JS
   ============================================ */

// State
let characters = [];
let magicItems = [];
let currentCharacter = null;

// DOM Elements
const characterSelect = document.getElementById('characterSelect');
const characterSheet = document.getElementById('characterSheet');
const characterGrid = document.getElementById('characterGrid');
const backBtn = document.getElementById('backBtn');
const itemModal = document.getElementById('itemModal');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadData();
    renderCharacterSelect();
    setupEventListeners();
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    try {
        const [charResponse, itemsResponse] = await Promise.all([
            fetch('data/characters.json'),
            fetch('data/magic-items.json')
        ]);
        
        const charData = await charResponse.json();
        const itemsData = await itemsResponse.json();
        
        characters = charData.characters;
        magicItems = itemsData.magicItems;
    } catch (error) {
        console.error('Failed to load data:', error);
        characters = [];
        magicItems = [];
    }
}

function getMagicItem(id) {
    return magicItems.find(item => item.id === id);
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
    
    // Magic Items
    renderMagicItems();
    
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

// ============================================
// MAGIC ITEMS TAB
// ============================================

function renderMagicItems() {
    const char = currentCharacter;
    const itemIds = char.equippedMagicItems || [];
    
    if (itemIds.length === 0) {
        document.getElementById('magicItemsList').innerHTML = `
            <div class="no-items">No magic items equipped</div>
        `;
        return;
    }
    
    const ICON_BASE = 'https://api.iconify.design/game-icons';
    const ICON_COLOR = '%23f2d38a';
    
    document.getElementById('magicItemsList').innerHTML = itemIds.map(id => {
        const item = getMagicItem(id);
        if (!item) return '';
        
        const icon = item.icon || 'swap-bag';
        
        return `
            <div class="magic-item-card" data-item-id="${item.id}">
                <img src="${ICON_BASE}/${icon}.svg?color=${ICON_COLOR}" alt="" class="magic-item-icon">
                <div class="magic-item-info">
                    <div class="magic-item-name">${item.name}</div>
                    <div class="magic-item-type">${item.type} • <span class="rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity}</span></div>
                    ${item.damage ? `<div class="magic-item-damage">${item.damage}${item.bonus ? ` (${item.bonus})` : ''}</div>` : ''}
                </div>
                <div class="magic-item-arrow">›</div>
            </div>
        `;
    }).join('');
}

function showItemDetail(itemId) {
    const item = getMagicItem(itemId);
    if (!item) return;
    
    const ICON_BASE = 'https://api.iconify.design/game-icons';
    const ICON_COLOR = '%23f2d38a';
    const icon = item.icon || 'swap-bag';
    
    let attunementText = '';
    if (item.attunement === true) {
        attunementText = '<div class="item-attunement">Requires Attunement</div>';
    } else if (item.attunement && item.attunement !== false) {
        attunementText = `<div class="item-attunement">Requires Attunement: ${item.attunement}</div>`;
    }
    
    document.getElementById('itemModalBody').innerHTML = `
        <div class="item-detail-header">
            <img src="${ICON_BASE}/${icon}.svg?color=${ICON_COLOR}" alt="" class="item-detail-icon">
            <div>
                <h2 class="item-detail-name">${item.name}</h2>
                <div class="item-detail-type">${item.type}</div>
                <div class="item-detail-rarity rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity}</div>
            </div>
        </div>
        
        ${attunementText}
        
        ${item.damage ? `
        <div class="item-stats">
            <div class="item-stat">
                <span class="item-stat-label">Damage</span>
                <span class="item-stat-value">${item.damage}</span>
            </div>
            ${item.bonus ? `
            <div class="item-stat">
                <span class="item-stat-label">Bonus</span>
                <span class="item-stat-value">${item.bonus}</span>
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        ${item.properties ? `
        <div class="item-properties">
            ${item.properties.map(p => `<span class="item-property">${p}</span>`).join('')}
        </div>
        ` : ''}
        
        <div class="item-description">${item.description}</div>
        
        ${item.features && item.features.length > 0 ? `
        <div class="item-features">
            ${item.features.map(f => `
                <div class="item-feature">
                    <div class="item-feature-name">${f.name}</div>
                    <div class="item-feature-desc">${f.description.replace(/\n/g, '<br>')}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    `;
    
    itemModal.classList.add('active');
}

function closeItemModal() {
    itemModal.classList.remove('active');
}

// ============================================
// INVENTORY TAB
// ============================================

function renderInventory() {
    const char = currentCharacter;
    
    // Currency
    document.getElementById('invGold').textContent = `${char.currency.gp} gp`;
    
    // Calculate total weight
    const totalWeight = char.inventory.reduce((sum, item) => sum + (item.weight * item.qty), 0);
    document.getElementById('invWeight').textContent = `${totalWeight} lb`;
    
    // Filter out magic items (they're shown in Items tab)
    const regularItems = char.inventory.filter(item => !item.magicItemId);
    
    // Items
    document.getElementById('inventoryList').innerHTML = regularItems.map(item => `
        <div class="inventory-item">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">×${item.qty}</span>
            <span class="item-weight">${item.weight > 0 ? item.weight * item.qty + ' lb' : '—'}</span>
        </div>
    `).join('');
}

// ============================================
// SPELLS TAB
// ============================================

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
    
    // Magic item clicks
    document.getElementById('magicItemsList').addEventListener('click', (e) => {
        const card = e.target.closest('.magic-item-card');
        if (card) {
            showItemDetail(card.dataset.itemId);
        }
    });
    
    // Close modal
    document.getElementById('closeItemModal').addEventListener('click', closeItemModal);
    itemModal.addEventListener('click', (e) => {
        if (e.target === itemModal) {
            closeItemModal();
        }
    });
}

// ============================================
// UTILITIES
// ============================================

function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}
