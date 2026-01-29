/* ============================================
   SCARLETT ISLES COMPANION - APP.JS
   Full Featured Version
   ============================================ */

// State
let characters = [];
let magicItems = [];
let shopItems = [];
let currentCharacter = null;

const ICON_BASE = 'https://api.iconify.design/game-icons';
const ICON_COLOR = '%23f2d38a';

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
        const [charResponse, itemsResponse, shopResponse] = await Promise.all([
            fetch('data/characters.json'),
            fetch('data/magic-items.json'),
            fetch('data/shop.json').catch(() => ({ json: () => ({ items: [] }) }))
        ]);
        
        const charData = await charResponse.json();
        const itemsData = await itemsResponse.json();
        const shopData = await shopResponse.json();
        
        characters = charData.characters;
        magicItems = itemsData.magicItems;
        shopItems = shopData.items || [];
    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

function getMagicItem(id) {
    return magicItems.find(item => item.id === id);
}

function saveCharacterData() {
    // Save to localStorage for persistence
    localStorage.setItem('scarlett-isles-characters', JSON.stringify(characters));
}

function loadSavedData() {
    const saved = localStorage.getItem('scarlett-isles-characters');
    if (saved) {
        const savedChars = JSON.parse(saved);
        // Merge saved HP/gold with loaded characters
        characters.forEach(char => {
            const savedChar = savedChars.find(c => c.id === char.id);
            if (savedChar) {
                char.combat.currentHp = savedChar.combat?.currentHp ?? char.combat.currentHp;
                char.combat.tempHp = savedChar.combat?.tempHp ?? 0;
                char.currency = savedChar.currency ?? char.currency;
                char.inventory = savedChar.inventory ?? char.inventory;
                char.equippedMagicItems = savedChar.equippedMagicItems ?? char.equippedMagicItems;
            }
        });
    }
}

// ============================================
// CHARACTER SELECT
// ============================================

function renderCharacterSelect() {
    loadSavedData();
    const grid = document.getElementById('characterGrid');
    grid.innerHTML = characters.map(char => `
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
    updateHpDisplay();
    document.getElementById('charAc').textContent = char.combat.armorClass;
    document.getElementById('charInit').textContent = formatModifier(char.combat.initiative);
    document.getElementById('charSpeed').textContent = char.combat.speed.split(' ')[0];
    
    renderAbilities();
    renderSaves();
    renderSkills();
    renderFeatures();
    renderWeapons();
    renderMagicItems();
    renderInventory();
    renderSpells();
    renderShop();
}

function updateHpDisplay() {
    const char = currentCharacter;
    const hpText = char.combat.tempHp > 0 
        ? `${char.combat.currentHp}+${char.combat.tempHp}/${char.combat.maxHp}`
        : `${char.combat.currentHp}/${char.combat.maxHp}`;
    document.getElementById('charHp').textContent = hpText;
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
        acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
        athletics: 'Athletics', deception: 'Deception', history: 'History',
        insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
        medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
        performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
        sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
    };
    
    document.getElementById('skillsList').innerHTML = Object.entries(skillMap).map(([key, name]) => {
        const skill = char.skills[key];
        let dotClass = skill.expertise ? 'expertise' : (skill.proficient ? 'proficient' : '');
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
    document.getElementById('featuresList').innerHTML = (char.features || []).map(f => 
        `<span class="feature-tag">${f}</span>`
    ).join('') || '<span class="feature-tag">No features</span>';
}

// ============================================
// WEAPONS TAB
// ============================================

function renderWeapons() {
    const char = currentCharacter;
    const weapons = char.weapons || [];
    
    document.getElementById('weaponsList').innerHTML = weapons.map(weapon => {
        const isMagic = weapon.magicItemId;
        const magicItem = isMagic ? getMagicItem(weapon.magicItemId) : null;
        
        return `
            <div class="weapon-card ${isMagic ? 'magic' : ''}" ${isMagic ? `data-item-id="${weapon.magicItemId}"` : ''}>
                <div class="weapon-header">
                    <span class="weapon-name">${weapon.name}</span>
                    ${isMagic ? '<span class="weapon-magic-badge">✦</span>' : ''}
                </div>
                <div class="weapon-stats">
                    <div class="weapon-stat">
                        <span class="weapon-stat-label">Attack</span>
                        <span class="weapon-stat-value">${formatModifier(weapon.attack)}</span>
                    </div>
                    <div class="weapon-stat">
                        <span class="weapon-stat-label">Damage</span>
                        <span class="weapon-stat-value">${weapon.damage}</span>
                    </div>
                    <div class="weapon-stat">
                        <span class="weapon-stat-label">Type</span>
                        <span class="weapon-stat-value">${weapon.type}</span>
                    </div>
                </div>
                ${weapon.properties ? `<div class="weapon-properties">${weapon.properties}</div>` : ''}
            </div>
        `;
    }).join('') || '<div class="no-items">No weapons</div>';
}

// ============================================
// MAGIC ITEMS TAB
// ============================================

function renderMagicItems() {
    const char = currentCharacter;
    const itemIds = char.equippedMagicItems || [];
    
    if (itemIds.length === 0) {
        document.getElementById('magicItemsList').innerHTML = '<div class="no-items">No magic items equipped</div>';
        return;
    }
    
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
            <div class="item-stat"><span class="item-stat-label">Damage</span><span class="item-stat-value">${item.damage}</span></div>
            ${item.bonus ? `<div class="item-stat"><span class="item-stat-label">Bonus</span><span class="item-stat-value">${item.bonus}</span></div>` : ''}
        </div>` : ''}
        ${item.properties ? `<div class="item-properties">${item.properties.map(p => `<span class="item-property">${p}</span>`).join('')}</div>` : ''}
        <div class="item-description">${item.description}</div>
        ${item.features?.length ? `<div class="item-features">${item.features.map(f => `
            <div class="item-feature">
                <div class="item-feature-name">${f.name}</div>
                <div class="item-feature-desc">${f.description.replace(/\n/g, '<br>')}</div>
            </div>
        `).join('')}</div>` : ''}
    `;
    
    openModal('itemModal');
}

// ============================================
// INVENTORY TAB
// ============================================

function renderInventory() {
    const char = currentCharacter;
    
    document.getElementById('invGold').textContent = `${char.currency.gp} gp`;
    
    const totalWeight = char.inventory.reduce((sum, item) => sum + (item.weight * item.qty), 0);
    document.getElementById('invWeight').textContent = `${totalWeight} lb`;
    
    const regularItems = char.inventory.filter(item => !item.magicItemId);
    
    document.getElementById('inventoryList').innerHTML = regularItems.map(item => `
        <div class="inventory-item">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">×${item.qty}</span>
            <span class="item-weight">${item.weight > 0 ? item.weight * item.qty + ' lb' : '—'}</span>
        </div>
    `).join('') || '<div class="no-items">No gear</div>';
}

// ============================================
// SPELLS TAB
// ============================================

function renderSpells() {
    const char = currentCharacter;
    const container = document.getElementById('spellsContent');
    
    if (!char.spells || (!char.spells.known?.length && !char.spells.cantrips?.length)) {
        container.innerHTML = '<div class="no-spells">No spellcasting abilities</div>';
        return;
    }
    
    let html = '';
    
    if (char.spells.ability) {
        html += `<div class="spell-stats">
            <div class="spell-stat"><div class="label">Ability</div><div class="value">${char.spells.ability}</div></div>
            ${char.spells.saveDC ? `<div class="spell-stat"><div class="label">Save DC</div><div class="value">${char.spells.saveDC}</div></div>` : ''}
            ${char.spells.attackBonus ? `<div class="spell-stat"><div class="label">Attack</div><div class="value">+${char.spells.attackBonus}</div></div>` : ''}
        </div>`;
    }
    
    if (char.spells.slots && Object.keys(char.spells.slots).length > 0) {
        html += `<div class="spell-section"><h4>Spell Slots</h4>
            ${Object.entries(char.spells.slots).map(([level, count]) => 
                `<div class="spell-item"><span class="spell-name">${level} Level: ${count} slots</span></div>`
            ).join('')}</div>`;
    }
    
    if (char.spells.cantrips?.length) {
        html += `<div class="spell-section"><h4>Cantrips</h4>
            ${char.spells.cantrips.map(spell => `
                <div class="spell-item">
                    <div class="spell-name">${spell.name}</div>
                    ${spell.source ? `<div class="spell-source">${spell.source}</div>` : ''}
                </div>
            `).join('')}</div>`;
    }
    
    if (char.spells.known?.length) {
        html += `<div class="spell-section"><h4>Spells</h4>
            ${char.spells.known.map(spell => `
                <div class="spell-item">
                    <div class="spell-name">${spell.name}${spell.prepared ? ' ★' : ''}${spell.ritual ? ' (R)' : ''}</div>
                    ${spell.source ? `<div class="spell-source">${spell.source}</div>` : ''}
                </div>
            `).join('')}</div>`;
    }
    
    container.innerHTML = html;
}

// ============================================
// HP TRACKER
// ============================================

function openHpModal() {
    const char = currentCharacter;
    document.getElementById('hpModalCurrent').textContent = char.combat.currentHp;
    document.getElementById('hpModalMax').textContent = char.combat.maxHp;
    document.getElementById('hpModalTemp').textContent = char.combat.tempHp || 0;
    updateHpBar();
    openModal('hpModal');
}

function updateHpBar() {
    const char = currentCharacter;
    const percent = Math.max(0, Math.min(100, (char.combat.currentHp / char.combat.maxHp) * 100));
    const bar = document.getElementById('hpBar');
    bar.style.width = percent + '%';
    
    // Color based on HP percentage
    if (percent > 50) bar.style.background = 'var(--hp-green)';
    else if (percent > 25) bar.style.background = '#cccc6c';
    else bar.style.background = 'var(--scarlet)';
}

function adjustHp(amount) {
    const char = currentCharacter;
    
    if (amount < 0) {
        // Damage - reduce temp HP first
        let damage = Math.abs(amount);
        if (char.combat.tempHp > 0) {
            if (char.combat.tempHp >= damage) {
                char.combat.tempHp -= damage;
                damage = 0;
            } else {
                damage -= char.combat.tempHp;
                char.combat.tempHp = 0;
            }
        }
        char.combat.currentHp = Math.max(0, char.combat.currentHp - damage);
    } else {
        // Healing - can't exceed max
        char.combat.currentHp = Math.min(char.combat.maxHp, char.combat.currentHp + amount);
    }
    
    document.getElementById('hpModalCurrent').textContent = char.combat.currentHp;
    document.getElementById('hpModalTemp').textContent = char.combat.tempHp || 0;
    updateHpBar();
    updateHpDisplay();
    saveCharacterData();
}

function fullHeal() {
    const char = currentCharacter;
    char.combat.currentHp = char.combat.maxHp;
    char.combat.tempHp = 0;
    document.getElementById('hpModalCurrent').textContent = char.combat.currentHp;
    document.getElementById('hpModalTemp').textContent = 0;
    updateHpBar();
    updateHpDisplay();
    saveCharacterData();
}

function addTempHp() {
    const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
    if (amount > 0) {
        currentCharacter.combat.tempHp = Math.max(currentCharacter.combat.tempHp || 0, amount);
        document.getElementById('hpModalTemp').textContent = currentCharacter.combat.tempHp;
        document.getElementById('hpCustomAmount').value = '';
        updateHpDisplay();
        saveCharacterData();
    }
}

// ============================================
// SHOP TAB
// ============================================

function renderShop() {
    const char = currentCharacter;
    document.getElementById('shopGold').textContent = `${char.currency.gp} gp`;
    
    const category = document.getElementById('shopCategory').value;
    
    // Use magic items as shop inventory for now
    let items = [...magicItems];
    
    if (category !== 'all') {
        items = items.filter(item => {
            const type = item.type.toLowerCase();
            if (category === 'weapon') return type.includes('weapon');
            if (category === 'armor') return type.includes('armor') || type.includes('shield');
            if (category === 'wondrous') return type.includes('wondrous');
            return true;
        });
    }
    
    document.getElementById('shopList').innerHTML = items.map(item => {
        const owned = char.equippedMagicItems?.includes(item.id);
        const canAfford = char.currency.gp >= item.cost;
        
        return `
            <div class="shop-item ${owned ? 'owned' : ''} ${!canAfford && !owned ? 'cant-afford' : ''}" data-item-id="${item.id}">
                <img src="${ICON_BASE}/${item.icon || 'swap-bag'}.svg?color=${ICON_COLOR}" alt="" class="shop-item-icon">
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-type rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity} ${item.type}</div>
                </div>
                <div class="shop-item-price">
                    ${owned ? '<span class="owned-badge">Owned</span>' : `<span class="price">${item.cost} gp</span>`}
                </div>
            </div>
        `;
    }).join('') || '<div class="no-items">No items available</div>';
}

function showShopItemDetail(itemId) {
    const item = getMagicItem(itemId);
    if (!item) return;
    
    const char = currentCharacter;
    const owned = char.equippedMagicItems?.includes(item.id);
    const canAfford = char.currency.gp >= item.cost;
    
    const icon = item.icon || 'swap-bag';
    
    document.getElementById('shopModalBody').innerHTML = `
        <div class="item-detail-header">
            <img src="${ICON_BASE}/${icon}.svg?color=${ICON_COLOR}" alt="" class="item-detail-icon">
            <div>
                <h2 class="item-detail-name">${item.name}</h2>
                <div class="item-detail-type">${item.type}</div>
                <div class="item-detail-rarity rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity}</div>
            </div>
        </div>
        <div class="shop-item-cost">
            <span class="cost-label">Price:</span>
            <span class="cost-value">${item.cost} gp</span>
        </div>
        ${item.attunement ? `<div class="item-attunement">Requires Attunement${typeof item.attunement === 'string' ? ': ' + item.attunement : ''}</div>` : ''}
        ${item.damage ? `<div class="item-stats">
            <div class="item-stat"><span class="item-stat-label">Damage</span><span class="item-stat-value">${item.damage}</span></div>
            ${item.bonus ? `<div class="item-stat"><span class="item-stat-label">Bonus</span><span class="item-stat-value">${item.bonus}</span></div>` : ''}
        </div>` : ''}
        <div class="item-description">${item.description}</div>
        ${item.features?.length ? `<div class="item-features">${item.features.map(f => `
            <div class="item-feature">
                <div class="item-feature-name">${f.name}</div>
                <div class="item-feature-desc">${f.description.replace(/\n/g, '<br>')}</div>
            </div>
        `).join('')}</div>` : ''}
        <div class="shop-actions">
            ${owned 
                ? '<button class="shop-btn owned" disabled>Already Owned</button>'
                : canAfford 
                    ? `<button class="shop-btn buy" data-item-id="${item.id}">Buy for ${item.cost} gp</button>`
                    : `<button class="shop-btn cant-afford" disabled>Can't Afford (${item.cost} gp)</button>`
            }
        </div>
    `;
    
    openModal('shopModal');
}

function buyItem(itemId) {
    const item = getMagicItem(itemId);
    const char = currentCharacter;
    
    if (!item || char.currency.gp < item.cost) return;
    
    // Deduct gold
    char.currency.gp -= item.cost;
    
    // Add to equipped items
    if (!char.equippedMagicItems) char.equippedMagicItems = [];
    char.equippedMagicItems.push(item.id);
    
    // Add to inventory
    char.inventory.push({
        name: item.name,
        qty: 1,
        weight: 0,
        magicItemId: item.id
    });
    
    // Update displays
    document.getElementById('charGold').textContent = `${char.currency.gp} gp`;
    renderShop();
    renderMagicItems();
    renderInventory();
    saveCharacterData();
    
    closeModal('shopModal');
    
    // Show confirmation
    showToast(`Purchased ${item.name}!`);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ============================================
// MODALS
// ============================================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ============================================
// NAVIGATION
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Character selection
    document.getElementById('characterGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.character-card');
        if (card) selectCharacter(card.dataset.id);
    });
    
    // Back button
    document.getElementById('backBtn').addEventListener('click', () => {
        showScreen('characterSelect');
        currentCharacter = null;
    });
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
    
    // HP Box click
    document.getElementById('hpBox').addEventListener('click', openHpModal);
    
    // Magic item clicks
    document.getElementById('magicItemsList').addEventListener('click', (e) => {
        const card = e.target.closest('.magic-item-card');
        if (card) showItemDetail(card.dataset.itemId);
    });
    
    // Weapon clicks (for magic weapons)
    document.getElementById('weaponsList').addEventListener('click', (e) => {
        const card = e.target.closest('.weapon-card.magic');
        if (card) showItemDetail(card.dataset.itemId);
    });
    
    // Shop item clicks
    document.getElementById('shopList').addEventListener('click', (e) => {
        const card = e.target.closest('.shop-item');
        if (card) showShopItemDetail(card.dataset.itemId);
    });
    
    // Shop category filter
    document.getElementById('shopCategory').addEventListener('change', renderShop);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    
    // Modal backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });
    
    // HP adjustment buttons
    document.querySelectorAll('.hp-btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.amount)));
    });
    
    // Custom damage/heal
    document.getElementById('hpDamageBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
        if (amount > 0) {
            adjustHp(-amount);
            document.getElementById('hpCustomAmount').value = '';
        }
    });
    
    document.getElementById('hpHealBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
        if (amount > 0) {
            adjustHp(amount);
            document.getElementById('hpCustomAmount').value = '';
        }
    });
    
    // Full heal
    document.getElementById('hpFullHeal').addEventListener('click', fullHeal);
    
    // Add temp HP
    document.getElementById('hpAddTemp').addEventListener('click', addTempHp);
    
    // Shop buy button (delegated)
    document.getElementById('shopModalBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('buy')) {
            buyItem(e.target.dataset.itemId);
        }
    });
}

// ============================================
// UTILITIES
// ============================================

function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}
