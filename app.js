/* ============================================
   SCARLETT ISLES COMPANION - FIREBASE VERSION
   Real-time sync across all players
   ============================================ */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCAtLDqghTbYhyhwcoTsefTiMecC30RMuQ",
    authDomain: "scarlett-isles-companion.firebaseapp.com",
    projectId: "scarlett-isles-companion",
    storageBucket: "scarlett-isles-companion.firebasestorage.app",
    messagingSenderId: "269614761446",
    appId: "1:269614761446:web:d420e1198e62b68a474227"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence().catch(err => {
    console.log('Persistence error:', err.code);
});

// ============================================
// STATE
// ============================================
let characters = [];
let magicItems = [];
let shopItems = [];
let currentPlayer = null;
let currentCharacter = null;
let wishlist = new Set();
let showingWishlistOnly = false;
let unsubscribeCharacters = null;

const ICON_BASE = 'https://api.iconify.design/game-icons';
const ICON_COLOR = '%23f2d38a';

// Player definitions
const PLAYERS = [
    { id: 'matt', name: 'Matt', characters: ['kaelen-of-wolfhaven'] },
    { id: 'harry', name: 'Harry (DM)', characters: ['charles-vect', 'elara-varrus', 'kaelen-of-wolfhaven', 'magnus-ironward', 'umbrys'], isDM: true },
    { id: 'player3', name: 'Player 3', characters: ['magnus-ironward'] },
    { id: 'player4', name: 'Player 4', characters: ['elara-varrus'] },
    { id: 'player5', name: 'Player 5', characters: ['umbrys'] },
    { id: 'player6', name: 'Player 6', characters: ['charles-vect'] }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    updateLoadingStatus('Loading game data...');
    
    try {
        // Load static data (character templates, items)
        await loadStaticData();
        
        updateLoadingStatus('Connecting to server...');
        
        // Initialize characters in Firebase if needed
        await initializeFirebaseData();
        
        updateLoadingStatus('Ready!');
        
        // Show player selection
        setTimeout(() => {
            renderPlayerSelect();
            showScreen('playerSelect');
        }, 500);
        
        setupEventListeners();
    } catch (error) {
        console.error('Init error:', error);
        updateLoadingStatus('Error: ' + error.message);
    }
}

function updateLoadingStatus(message) {
    document.getElementById('loadingStatus').textContent = message;
}

// ============================================
// DATA LOADING
// ============================================
async function loadStaticData() {
    const [charResponse, itemsResponse, shopResponse] = await Promise.all([
        fetch('data/characters.json'),
        fetch('data/magic-items.json'),
        fetch('data/shop.json').catch(() => null)
    ]);
    
    const charData = await charResponse.json();
    const itemsData = await itemsResponse.json();
    
    characters = charData.characters;
    magicItems = itemsData.magicItems || [];
    
    if (shopResponse) {
        const shopData = await shopResponse.json();
        shopItems = shopData.items || [];
    }
}

async function initializeFirebaseData() {
    // Check if characters exist in Firebase
    const snapshot = await db.collection('characters').get();
    
    if (snapshot.empty) {
        // First time setup - upload character data
        console.log('Initializing Firebase with character data...');
        const batch = db.batch();
        
        for (const char of characters) {
            const ref = db.collection('characters').doc(char.id);
            batch.set(ref, {
                ...char,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await batch.commit();
        console.log('Character data uploaded to Firebase');
    }
}

// ============================================
// REAL-TIME LISTENERS
// ============================================
function subscribeToCharacters() {
    if (unsubscribeCharacters) {
        unsubscribeCharacters();
    }
    
    unsubscribeCharacters = db.collection('characters')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const index = characters.findIndex(c => c.id === data.id);
                
                if (index !== -1) {
                    // Update local character data
                    characters[index] = { ...characters[index], ...data };
                    
                    // If this is the current character, update display
                    if (currentCharacter && currentCharacter.id === data.id) {
                        currentCharacter = characters[index];
                        updateHpDisplay();
                        document.getElementById('charGold').textContent = `${currentCharacter.currency.gp} gp`;
                    }
                    
                    // Update party HP display
                    renderPartyHp();
                }
            });
        }, error => {
            console.error('Firestore listener error:', error);
        });
}

// ============================================
// PLAYER SELECTION
// ============================================
function renderPlayerSelect() {
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = PLAYERS.map(player => `
        <div class="player-card ${player.isDM ? 'dm' : ''}" data-player-id="${player.id}">
            <div class="player-icon">${player.isDM ? '👑' : '⚔️'}</div>
            <div class="player-name">${player.name}</div>
            ${player.isDM ? '<div class="player-role">Dungeon Master</div>' : ''}
        </div>
    `).join('');
}

function selectPlayer(playerId) {
    currentPlayer = PLAYERS.find(p => p.id === playerId);
    if (!currentPlayer) return;
    
    document.getElementById('playerNameDisplay').textContent = currentPlayer.name;
    
    // Load wishlist for this player
    loadWishlist();
    
    // Subscribe to real-time updates
    subscribeToCharacters();
    
    renderCharacterSelect();
    showScreen('characterSelect');
}

// ============================================
// CHARACTER SELECTION
// ============================================
function renderCharacterSelect() {
    const grid = document.getElementById('characterGrid');
    const availableChars = currentPlayer.isDM 
        ? characters 
        : characters.filter(c => currentPlayer.characters.includes(c.id));
    
    grid.innerHTML = availableChars.map(char => `
        <div class="character-card" data-id="${char.id}">
            <img src="${char.image}" alt="${char.name}" class="portrait-thumb">
            <div class="char-name">${char.name}</div>
            <div class="char-class">${char.class} ${char.level}</div>
            <div class="char-hp-preview">${char.combat?.currentHp || char.combat?.maxHp}/${char.combat?.maxHp} HP</div>
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
    
    renderPartyHp();
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
    if (!char) return;
    
    const tempHp = char.combat.tempHp || 0;
    const hpText = tempHp > 0 
        ? `${char.combat.currentHp}+${tempHp}/${char.combat.maxHp}`
        : `${char.combat.currentHp}/${char.combat.maxHp}`;
    document.getElementById('charHp').textContent = hpText;
}

function renderPartyHp() {
    const list = document.getElementById('partyHpList');
    if (!list) return;
    
    list.innerHTML = characters.map(char => {
        const percent = Math.round((char.combat.currentHp / char.combat.maxHp) * 100);
        const isCurrentChar = currentCharacter && char.id === currentCharacter.id;
        
        let barColor = 'var(--hp-green)';
        if (percent <= 25) barColor = 'var(--scarlet)';
        else if (percent <= 50) barColor = '#cccc6c';
        
        return `
            <div class="party-hp-item ${isCurrentChar ? 'current' : ''}">
                <span class="party-hp-name">${char.name.split(' ')[0]}</span>
                <div class="party-hp-bar-container">
                    <div class="party-hp-bar" style="width: ${percent}%; background: ${barColor}"></div>
                </div>
                <span class="party-hp-text">${char.combat.currentHp}/${char.combat.maxHp}</span>
            </div>
        `;
    }).join('');
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

function getMagicItem(id) {
    return magicItems.find(item => item.id === id);
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
// HP TRACKER (with Firebase sync)
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
    
    if (percent > 50) bar.style.background = 'var(--hp-green)';
    else if (percent > 25) bar.style.background = '#cccc6c';
    else bar.style.background = 'var(--scarlet)';
}

async function adjustHp(amount) {
    const char = currentCharacter;
    
    if (amount < 0) {
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
        char.combat.currentHp = Math.min(char.combat.maxHp, char.combat.currentHp + amount);
    }
    
    // Update UI
    document.getElementById('hpModalCurrent').textContent = char.combat.currentHp;
    document.getElementById('hpModalTemp').textContent = char.combat.tempHp || 0;
    updateHpBar();
    updateHpDisplay();
    
    // Sync to Firebase
    await syncCharacterToFirebase(char);
}

async function fullHeal() {
    const char = currentCharacter;
    char.combat.currentHp = char.combat.maxHp;
    char.combat.tempHp = 0;
    
    document.getElementById('hpModalCurrent').textContent = char.combat.currentHp;
    document.getElementById('hpModalTemp').textContent = 0;
    updateHpBar();
    updateHpDisplay();
    
    await syncCharacterToFirebase(char);
}

async function addTempHp() {
    const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
    if (amount > 0) {
        currentCharacter.combat.tempHp = Math.max(currentCharacter.combat.tempHp || 0, amount);
        document.getElementById('hpModalTemp').textContent = currentCharacter.combat.tempHp;
        document.getElementById('hpCustomAmount').value = '';
        updateHpDisplay();
        await syncCharacterToFirebase(currentCharacter);
    }
}

async function syncCharacterToFirebase(char) {
    try {
        await db.collection('characters').doc(char.id).update({
            'combat.currentHp': char.combat.currentHp,
            'combat.tempHp': char.combat.tempHp || 0,
            'currency': char.currency,
            'inventory': char.inventory,
            'equippedMagicItems': char.equippedMagicItems || [],
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Sync error:', error);
        showToast('Sync failed - changes saved locally');
    }
}

// ============================================
// SHOP TAB
// ============================================
function renderShop() {
    const char = currentCharacter;
    document.getElementById('shopGold').textContent = `${char.currency.gp} gp`;
    document.getElementById('wishlistCount').textContent = wishlist.size;
    
    const province = document.getElementById('shopProvince').value;
    const category = document.getElementById('shopCategory').value;
    
    let items = [...magicItems];
    
    // Filter by wishlist if toggled
    if (showingWishlistOnly) {
        items = items.filter(item => wishlist.has(item.id));
    }
    
    // Filter by category
    if (category !== 'all') {
        items = items.filter(item => {
            const type = item.type.toLowerCase();
            if (category === 'weapon') return type.includes('weapon');
            if (category === 'armor') return type.includes('armor') || type.includes('shield');
            if (category === 'wondrous') return type.includes('wondrous');
            if (category === 'potion') return type.includes('potion');
            if (category === 'scroll') return type.includes('scroll');
            return true;
        });
    }
    
    document.getElementById('shopList').innerHTML = items.map(item => {
        const owned = char.equippedMagicItems?.includes(item.id);
        const canAfford = char.currency.gp >= item.cost;
        const isWishlisted = wishlist.has(item.id);
        
        return `
            <div class="shop-item ${owned ? 'owned' : ''} ${!canAfford && !owned ? 'cant-afford' : ''}" data-item-id="${item.id}">
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${item.id}">★</button>
                <img src="${ICON_BASE}/${item.icon || 'swap-bag'}.svg?color=${ICON_COLOR}" alt="" class="shop-item-icon">
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-type rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity}</div>
                </div>
                <div class="shop-item-price">
                    ${owned ? '<span class="owned-badge">Owned</span>' : `<span class="price">${item.cost} gp</span>`}
                </div>
            </div>
        `;
    }).join('') || '<div class="no-items">No items match your filters</div>';
}

function showShopItemDetail(itemId) {
    const item = getMagicItem(itemId);
    if (!item) return;
    
    const char = currentCharacter;
    const owned = char.equippedMagicItems?.includes(item.id);
    const canAfford = char.currency.gp >= item.cost;
    const isWishlisted = wishlist.has(item.id);
    
    document.getElementById('shopModalBody').innerHTML = `
        <div class="item-detail-header">
            <img src="${ICON_BASE}/${item.icon || 'swap-bag'}.svg?color=${ICON_COLOR}" alt="" class="item-detail-icon">
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
            <button class="shop-btn wishlist ${isWishlisted ? 'active' : ''}" data-wishlist-id="${item.id}">
                ${isWishlisted ? '★ On Wishlist' : '☆ Add to Wishlist'}
            </button>
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

async function buyItem(itemId) {
    const item = getMagicItem(itemId);
    const char = currentCharacter;
    
    if (!item || char.currency.gp < item.cost) return;
    
    char.currency.gp -= item.cost;
    if (!char.equippedMagicItems) char.equippedMagicItems = [];
    char.equippedMagicItems.push(item.id);
    char.inventory.push({ name: item.name, qty: 1, weight: 0, magicItemId: item.id });
    
    document.getElementById('charGold').textContent = `${char.currency.gp} gp`;
    renderShop();
    renderMagicItems();
    renderInventory();
    
    await syncCharacterToFirebase(char);
    
    closeModal('shopModal');
    showToast(`Purchased ${item.name}!`);
}

// ============================================
// WISHLIST
// ============================================
function toggleWishlist(itemId) {
    if (wishlist.has(itemId)) {
        wishlist.delete(itemId);
    } else {
        wishlist.add(itemId);
    }
    saveWishlist();
    renderShop();
    document.getElementById('wishlistCount').textContent = wishlist.size;
}

function saveWishlist() {
    localStorage.setItem(`wishlist-${currentPlayer.id}`, JSON.stringify([...wishlist]));
}

function loadWishlist() {
    const saved = localStorage.getItem(`wishlist-${currentPlayer.id}`);
    wishlist = new Set(saved ? JSON.parse(saved) : []);
}

function toggleWishlistView() {
    showingWishlistOnly = !showingWishlistOnly;
    document.getElementById('wishlistToggle').classList.toggle('active', showingWishlistOnly);
    renderShop();
}

// ============================================
// MODALS & NAVIGATION
// ============================================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
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
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Player selection
    document.getElementById('playerGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.player-card');
        if (card) selectPlayer(card.dataset.playerId);
    });
    
    // Player back button
    document.getElementById('playerBackBtn').addEventListener('click', () => {
        showScreen('playerSelect');
        currentPlayer = null;
    });
    
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
    
    // Weapon clicks
    document.getElementById('weaponsList').addEventListener('click', (e) => {
        const card = e.target.closest('.weapon-card.magic');
        if (card) showItemDetail(card.dataset.itemId);
    });
    
    // Shop clicks
    document.getElementById('shopList').addEventListener('click', (e) => {
        // Wishlist button
        const wishlistBtn = e.target.closest('.wishlist-btn');
        if (wishlistBtn) {
            e.stopPropagation();
            toggleWishlist(wishlistBtn.dataset.wishlistId);
            return;
        }
        
        // Item card
        const card = e.target.closest('.shop-item');
        if (card) showShopItemDetail(card.dataset.itemId);
    });
    
    // Shop filters
    document.getElementById('shopProvince').addEventListener('change', renderShop);
    document.getElementById('shopCategory').addEventListener('change', renderShop);
    document.getElementById('wishlistToggle').addEventListener('click', toggleWishlistView);
    
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
    
    // HP controls
    document.querySelectorAll('.hp-btn[data-amount]').forEach(btn => {
        btn.addEventListener('click', () => adjustHp(parseInt(btn.dataset.amount)));
    });
    
    document.getElementById('hpDamageBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
        if (amount > 0) { adjustHp(-amount); document.getElementById('hpCustomAmount').value = ''; }
    });
    
    document.getElementById('hpHealBtn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hpCustomAmount').value) || 0;
        if (amount > 0) { adjustHp(amount); document.getElementById('hpCustomAmount').value = ''; }
    });
    
    document.getElementById('hpFullHeal').addEventListener('click', fullHeal);
    document.getElementById('hpAddTemp').addEventListener('click', addTempHp);
    
    // Shop modal actions
    document.getElementById('shopModalBody').addEventListener('click', (e) => {
        if (e.target.classList.contains('buy')) {
            buyItem(e.target.dataset.itemId);
        }
        if (e.target.dataset.wishlistId) {
            toggleWishlist(e.target.dataset.wishlistId);
            showShopItemDetail(e.target.dataset.wishlistId); // Refresh modal
        }
    });
}

// ============================================
// UTILITIES
// ============================================
function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}
