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
let shopData = null;
let worldData = null;
let currentPlayer = null;
let currentCharacter = null;
let currentSettlement = null;
let wishlist = new Set();
let showingWishlistOnly = false;
let unsubscribeCharacters = null;
let shopMode = 'buy'; // 'buy' or 'sell'

const ICON_BASE = 'https://api.iconify.design/game-icons';
const ICON_COLOR = '%23f2d38a';

// Player definitions - Characters only (we're nerds!)
const PLAYERS = [
    { id: 'kaelen', name: 'Kaelen', characters: ['kaelen-of-wolfhaven'] },
    { id: 'magnus', name: 'Magnus', characters: ['magnus-ironward'] },
    { id: 'elara', name: 'Elara', characters: ['elara-varrus'] },
    { id: 'umbrys', name: 'Umbrys', characters: ['umbrys'] },
    { id: 'charles', name: 'Charles', characters: ['charles-vect'] },
    { id: 'dm', name: 'Dungeon Master', characters: ['charles-vect', 'elara-varrus', 'kaelen-of-wolfhaven', 'magnus-ironward', 'umbrys'], isDM: true }
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
    const [charResponse, itemsResponse, shopResponse, worldResponse] = await Promise.all([
        fetch('data/characters.json'),
        fetch('data/magic-items.json'),
        fetch('data/shop.json'),
        fetch('data/world.json').catch(() => null)
    ]);
    
    const charData = await charResponse.json();
    const itemsData = await itemsResponse.json();
    shopData = await shopResponse.json();
    
    if (worldResponse) {
        worldData = await worldResponse.json();
    }
    
    characters = charData.characters;
    magicItems = itemsData.magicItems || [];
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
                        updateCoinPurseDisplay();
                        renderShop(); // Update shop gold display
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

// Format currency display (shows total in GP for header)
function formatCurrency(currency) {
    if (!currency) return '0 gp';
    
    // Calculate total value in GP
    const totalGp = Math.floor(
        (currency.pp || 0) * 10 +
        (currency.gp || 0) +
        (currency.ep || 0) * 0.5 +
        (currency.sp || 0) * 0.1 +
        (currency.cp || 0) * 0.01
    );
    
    return `${totalGp} gp`;
}

// Format a price for display (converts GP decimals to proper denominations)
// e.g., 0.2 gp -> "2 sp", 0.02 gp -> "2 cp", 1.5 gp -> "1 gp 5 sp"
function formatPrice(priceInGp) {
    if (!priceInGp || priceInGp === 0) return '0 cp';
    
    // Convert to copper for precision
    const totalCopper = Math.round(priceInGp * 100);
    
    const gp = Math.floor(totalCopper / 100);
    const remainder = totalCopper % 100;
    const sp = Math.floor(remainder / 10);
    const cp = remainder % 10;
    
    const parts = [];
    if (gp > 0) parts.push(`${gp} gp`);
    if (sp > 0) parts.push(`${sp} sp`);
    if (cp > 0) parts.push(`${cp} cp`);
    
    return parts.length > 0 ? parts.join(' ') : '0 cp';
}

// Update coin purse modal display
function updateCoinPurseDisplay() {
    const char = currentCharacter;
    if (!char) return;
    
    const currency = char.currency || {};
    
    document.getElementById('currencyPP').textContent = currency.pp || 0;
    document.getElementById('currencyGP').textContent = currency.gp || 0;
    document.getElementById('currencyEP').textContent = currency.ep || 0;
    document.getElementById('currencySP').textContent = currency.sp || 0;
    document.getElementById('currencyCP').textContent = currency.cp || 0;
    document.getElementById('currencyTotal').textContent = formatCurrency(currency);
    
    // Show DM edit button only for DM
    const dmBtn = document.getElementById('dmEditCurrencyBtn');
    if (dmBtn) {
        dmBtn.style.display = currentPlayer?.isDM ? 'block' : 'none';
    }
}

// Open coin purse
function openCoinPurse() {
    updateCoinPurseDisplay();
    // Always show view mode first
    document.getElementById('coinPurseView').style.display = 'block';
    document.getElementById('coinPurseEdit').style.display = 'none';
    document.getElementById('coinPurseModal').classList.add('open');
}

// Close coin purse
function closeCoinPurse() {
    document.getElementById('coinPurseModal').classList.remove('open');
    // Reset to view mode
    document.getElementById('coinPurseView').style.display = 'block';
    document.getElementById('coinPurseEdit').style.display = 'none';
}

// DM: Enter edit mode
function enterCurrencyEditMode() {
    const char = currentCharacter;
    if (!char || !currentPlayer?.isDM) return;
    
    const currency = char.currency || {};
    
    // Populate edit inputs
    document.getElementById('editPP').value = currency.pp || 0;
    document.getElementById('editGP').value = currency.gp || 0;
    document.getElementById('editEP').value = currency.ep || 0;
    document.getElementById('editSP').value = currency.sp || 0;
    document.getElementById('editCP').value = currency.cp || 0;
    
    // Switch to edit mode
    document.getElementById('coinPurseView').style.display = 'none';
    document.getElementById('coinPurseEdit').style.display = 'block';
}

// DM: Cancel edit mode
function cancelCurrencyEdit() {
    document.getElementById('coinPurseView').style.display = 'block';
    document.getElementById('coinPurseEdit').style.display = 'none';
}

// DM: Save currency changes
async function saveCurrencyEdit() {
    const char = currentCharacter;
    if (!char || !currentPlayer?.isDM) return;
    
    // Get values from inputs
    char.currency = {
        pp: Math.max(0, parseInt(document.getElementById('editPP').value) || 0),
        gp: Math.max(0, parseInt(document.getElementById('editGP').value) || 0),
        ep: Math.max(0, parseInt(document.getElementById('editEP').value) || 0),
        sp: Math.max(0, parseInt(document.getElementById('editSP').value) || 0),
        cp: Math.max(0, parseInt(document.getElementById('editCP').value) || 0)
    };
    
    // Update display
    updateCoinPurseDisplay();
    renderShop();
    renderInventory();
    
    // Sync to Firebase
    await syncCharacterToFirebase(char);
    
    // Switch back to view mode
    cancelCurrencyEdit();
    showToast('Currency updated!');
}

// DM: Adjust currency with +/- buttons
function adjustCurrency(denomination, delta) {
    const input = document.getElementById(`edit${denomination.toUpperCase()}`);
    if (!input) return;
    
    const currentValue = parseInt(input.value) || 0;
    input.value = Math.max(0, currentValue + delta);
}

// Get full currency breakdown
function getCurrencyBreakdown(currency) {
    if (!currency) return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    return {
        pp: Math.floor(currency.pp || 0),
        gp: Math.floor(currency.gp || 0),
        ep: Math.floor(currency.ep || 0),
        sp: Math.floor(currency.sp || 0),
        cp: Math.floor(currency.cp || 0)
    };
}

// Render full currency display with all denominations
function renderCurrencyDisplay(currency) {
    const parts = [];
    if (currency.pp > 0) parts.push(`<span class="currency-pp">${currency.pp} pp</span>`);
    if (currency.gp > 0) parts.push(`<span class="currency-gp">${currency.gp} gp</span>`);
    if (currency.ep > 0) parts.push(`<span class="currency-ep">${currency.ep} ep</span>`);
    if (currency.sp > 0) parts.push(`<span class="currency-sp">${currency.sp} sp</span>`);
    if (currency.cp > 0) parts.push(`<span class="currency-cp">${currency.cp} cp</span>`);
    
    if (parts.length === 0) return '<span class="currency-gp">0 gp</span>';
    return parts.join(' ');
}

// Calculate total value in copper (base unit)
function getTotalCopper(currency) {
    if (!currency) return 0;
    return Math.floor(
        (currency.pp || 0) * 1000 +
        (currency.gp || 0) * 100 +
        (currency.ep || 0) * 50 +
        (currency.sp || 0) * 10 +
        (currency.cp || 0)
    );
}

// Deduct cost from currency (cost is in gp, can be decimal like 0.2)
// Change is ONLY given in common currencies: GP, SP, CP (never PP or EP)
function deductGold(currency, costInGp) {
    // Convert cost to copper for precision
    const costInCopper = Math.round(costInGp * 100);
    const totalCopper = getTotalCopper(currency);
    
    if (totalCopper < costInCopper) return false; // Can't afford
    
    let toPay = costInCopper;
    
    // Pay with copper first
    const cpToPay = Math.min(currency.cp || 0, toPay);
    currency.cp = (currency.cp || 0) - cpToPay;
    toPay -= cpToPay;
    if (toPay === 0) return true;
    
    // Pay with silver (1 sp = 10 cp)
    const spToPay = Math.min(currency.sp || 0, Math.floor(toPay / 10));
    currency.sp = (currency.sp || 0) - spToPay;
    toPay -= spToPay * 10;
    
    // If toPay is still > 0 but < 10, we need to break a silver for change
    if (toPay > 0 && toPay < 10 && (currency.sp || 0) > 0) {
        currency.sp -= 1;
        currency.cp = (currency.cp || 0) + (10 - toPay);
        toPay = 0;
    }
    if (toPay === 0) return true;
    
    // Pay with electrum (1 ep = 50 cp) - give change in SP and CP only
    const epToPay = Math.min(currency.ep || 0, Math.floor(toPay / 50));
    currency.ep = (currency.ep || 0) - epToPay;
    toPay -= epToPay * 50;
    
    // If need to break an electrum for change (give change in SP/CP only)
    if (toPay > 0 && toPay < 50 && (currency.ep || 0) > 0) {
        currency.ep -= 1;
        const change = 50 - toPay;
        currency.sp = (currency.sp || 0) + Math.floor(change / 10);
        currency.cp = (currency.cp || 0) + (change % 10);
        toPay = 0;
    }
    if (toPay === 0) return true;
    
    // Pay with gold (1 gp = 100 cp) - give change in SP and CP only
    const gpToPay = Math.min(currency.gp || 0, Math.floor(toPay / 100));
    currency.gp = (currency.gp || 0) - gpToPay;
    toPay -= gpToPay * 100;
    
    // If need to break a gold for change (give change in SP/CP only)
    if (toPay > 0 && toPay < 100 && (currency.gp || 0) > 0) {
        currency.gp -= 1;
        const change = 100 - toPay;
        currency.sp = (currency.sp || 0) + Math.floor(change / 10);
        currency.cp = (currency.cp || 0) + (change % 10);
        toPay = 0;
    }
    if (toPay === 0) return true;
    
    // Pay with platinum (1 pp = 1000 cp = 10 gp) - give change in GP, SP, CP only
    const ppToPay = Math.min(currency.pp || 0, Math.floor(toPay / 1000));
    currency.pp = (currency.pp || 0) - ppToPay;
    toPay -= ppToPay * 1000;
    
    // If need to break a platinum for change (give change in GP/SP/CP only - never PP)
    if (toPay > 0 && (currency.pp || 0) > 0) {
        currency.pp -= 1;
        const change = 1000 - toPay;
        currency.gp = (currency.gp || 0) + Math.floor(change / 100);
        const remainder = change % 100;
        currency.sp = (currency.sp || 0) + Math.floor(remainder / 10);
        currency.cp = (currency.cp || 0) + (remainder % 10);
        toPay = 0;
    }
    
    return toPay === 0;
}

// Check if can afford (cost in gp, can be decimal)
function canAfford(currency, costInGp) {
    const totalCopper = getTotalCopper(currency);
    const costInCopper = Math.round(costInGp * 100);
    return totalCopper >= costInCopper;
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
    
    // Get equipped weapons from equipment array
    const weapons = (char.equipment || []).filter(item => 
        item.type === 'weapon' && item.equipped
    );
    
    document.getElementById('weaponsList').innerHTML = weapons.map(weapon => {
        const isMagic = weapon.magical;
        return `
            <div class="weapon-card ${isMagic ? 'magic' : ''}" data-item-id="${weapon.id}">
                <div class="weapon-header">
                    <span class="weapon-name">${weapon.name}</span>
                    ${isMagic ? '<span class="weapon-magic-badge">✦</span>' : ''}
                </div>
                <div class="weapon-stats">
                    <div class="weapon-stat">
                        <span class="weapon-stat-label">Damage</span>
                        <span class="weapon-stat-value">${weapon.damage || '—'}</span>
                    </div>
                    <div class="weapon-stat">
                        <span class="weapon-stat-label">Type</span>
                        <span class="weapon-stat-value">${weapon.damageType || '—'}</span>
                    </div>
                </div>
                ${weapon.properties ? `<div class="weapon-properties">${weapon.properties.join(', ')}</div>` : ''}
                ${weapon.effect ? `<div class="weapon-effect">${weapon.effect}</div>` : ''}
            </div>
        `;
    }).join('') || '<div class="no-items">No weapons equipped</div>';
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
// INVENTORY/GEAR TAB - D&D Beyond Style
// ============================================
function renderInventory() {
    const char = currentCharacter;
    
    // Calculate weights
    const equipmentWeight = (char.equipment || []).reduce((sum, item) => {
        if (item.equipped) return sum + (item.weight || 0) * (item.qty || 1);
        return sum;
    }, 0);
    const backpackWeight = (char.backpack || []).reduce((sum, item) => sum + (item.weight || 0) * (item.qty || 1), 0);
    const totalWeight = equipmentWeight + backpackWeight;
    
    // Show total GP value (tap coin purse in header for breakdown)
    document.getElementById('invGold').textContent = formatCurrency(char.currency);
    document.getElementById('invWeight').textContent = `${totalWeight} lb`;
    
    const container = document.getElementById('inventoryList');
    
    // Build Equipment Section
    const equippedItems = (char.equipment || []).filter(item => item.equipped);
    const unequippedItems = (char.equipment || []).filter(item => !item.equipped);
    
    let html = `
        <div class="inv-section">
            <div class="inv-section-header">
                <h4>EQUIPMENT (${equippedItems.length})</h4>
                <span class="inv-weight">${equipmentWeight} lb</span>
            </div>
            <div class="inv-items">
                ${equippedItems.length ? equippedItems.map(item => renderEquipmentItem(item, true)).join('') : '<div class="no-items">Nothing equipped</div>'}
            </div>
        </div>
    `;
    
    // Unequipped equipment (not in backpack)
    if (unequippedItems.length > 0) {
        html += `
            <div class="inv-section">
                <div class="inv-section-header">
                    <h4>UNEQUIPPED</h4>
                </div>
                <div class="inv-items">
                    ${unequippedItems.map(item => renderEquipmentItem(item, false)).join('')}
                </div>
            </div>
        `;
    }
    
    // Backpack Section
    html += `
        <div class="inv-section">
            <div class="inv-section-header">
                <h4>BACKPACK (${(char.backpack || []).length})</h4>
                <span class="inv-weight">${backpackWeight} lb</span>
            </div>
            <div class="inv-items">
                ${(char.backpack || []).length ? (char.backpack || []).map(item => renderBackpackItem(item)).join('') : '<div class="no-items">Backpack empty</div>'}
            </div>
        </div>
    `;
    
    // Attunement Section
    const attunement = char.attunement || { max: 3, slots: [null, null, null] };
    const attunedItems = attunement.slots.map(slotId => {
        if (!slotId) return null;
        return (char.equipment || []).find(item => item.id === slotId);
    });
    
    html += `
        <div class="inv-section attunement-section">
            <div class="inv-section-header">
                <h4>ATTUNED ITEMS</h4>
                <span class="attune-count">${attunedItems.filter(i => i).length}/${attunement.max}</span>
            </div>
            <div class="attunement-slots">
                ${attunement.slots.map((slotId, index) => {
                    const item = attunedItems[index];
                    if (item) {
                        return `
                            <div class="attunement-slot filled" data-slot="${index}" data-item-id="${item.id}">
                                <div class="attune-item-name">${item.name}</div>
                                <div class="attune-item-effect">${item.effect || 'Magical'}</div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="attunement-slot empty" data-slot="${index}">
                                <div class="attune-empty">Empty Slot</div>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderEquipmentItem(item, isEquipped) {
    const isMagic = item.magical;
    const isAttuned = isItemAttuned(item.id);
    const needsAttunement = item.attunement && !isAttuned;
    
    let typeIcon = getTypeIcon(item.type);
    let checkboxClass = isMagic ? 'magic' : 'normal';
    if (isEquipped) checkboxClass += ' checked';
    
    return `
        <div class="inv-item ${isMagic ? 'magical' : ''} ${needsAttunement ? 'needs-attunement' : ''}" data-item-id="${item.id}" data-location="equipment">
            <div class="inv-item-checkbox ${checkboxClass}"></div>
            <div class="inv-item-info">
                <div class="inv-item-name">${item.name}${isMagic ? ' ✦' : ''}</div>
                <div class="inv-item-type">${item.type?.toUpperCase() || 'ITEM'}${item.damage ? ' • ' + item.damage : ''}</div>
            </div>
            <div class="inv-item-meta">
                ${item.qty && item.qty > 1 ? `<span class="inv-qty">${item.qty}</span>` : ''}
                <span class="inv-weight-small">${item.weight || 0} lb</span>
            </div>
        </div>
    `;
}

function renderBackpackItem(item) {
    return `
        <div class="inv-item backpack-item" data-item-id="${item.id}" data-location="backpack">
            <div class="inv-item-info">
                <div class="inv-item-name">${item.name}</div>
                <div class="inv-item-type">${item.type?.toUpperCase() || 'GEAR'}</div>
            </div>
            <div class="inv-item-meta">
                ${item.qty && item.qty > 1 ? `<span class="inv-qty">${item.qty}</span>` : ''}
                <span class="inv-weight-small">${(item.weight || 0) * (item.qty || 1)} lb</span>
            </div>
        </div>
    `;
}

function getTypeIcon(type) {
    const icons = {
        'weapon': '⚔️',
        'armor': '🛡️',
        'shield': '🛡️',
        'wondrous': '✨',
        'tool': '🔧',
        'gear': '🎒',
        'ammunition': '🏹',
        'container': '📦'
    };
    return icons[type?.toLowerCase()] || '📦';
}

function isItemAttuned(itemId) {
    const char = currentCharacter;
    if (!char.attunement) return false;
    return char.attunement.slots.includes(itemId);
}

// Item interaction modal
function showInventoryItemModal(itemId, location) {
    const char = currentCharacter;
    let item;
    
    if (location === 'equipment') {
        item = char.equipment.find(i => i.id === itemId);
    } else {
        item = char.backpack.find(i => i.id === itemId);
    }
    
    if (!item) return;
    
    const isEquipped = item.equipped === true;
    const isAttuned = isItemAttuned(itemId);
    const canAttune = item.attunement && !isAttuned;
    const hasAttunementSlot = (char.attunement?.slots || []).some(s => s === null);
    
    // Calculate sell price
    const sellInfo = calculateSellPrice(item);
    
    let actionsHtml = '<div class="item-actions">';
    
    if (location === 'equipment') {
        if (isEquipped) {
            actionsHtml += `<button class="item-action-btn unequip" data-item-id="${itemId}">Unequip</button>`;
        } else {
            actionsHtml += `<button class="item-action-btn equip" data-item-id="${itemId}">Equip</button>`;
        }
        actionsHtml += `<button class="item-action-btn to-backpack" data-item-id="${itemId}">→ Backpack</button>`;
    } else {
        actionsHtml += `<button class="item-action-btn to-equipment" data-item-id="${itemId}">→ Equipment</button>`;
    }
    
    if (item.attunement) {
        if (isAttuned) {
            actionsHtml += `<button class="item-action-btn unattune" data-item-id="${itemId}">Break Attunement</button>`;
        } else if (hasAttunementSlot) {
            actionsHtml += `<button class="item-action-btn attune" data-item-id="${itemId}">Attune</button>`;
        } else {
            actionsHtml += `<button class="item-action-btn disabled" disabled>No Attunement Slots</button>`;
        }
    }
    
    // Add sell button if item can be sold
    if (sellInfo.canSell) {
        actionsHtml += `<button class="item-action-btn sell" data-item-id="${itemId}" data-location="${location}" data-price="${sellInfo.priceInGp}">💰 Sell for ${formatPrice(sellInfo.priceInGp)}</button>`;
    }
    
    actionsHtml += `<button class="item-action-btn drop" data-item-id="${itemId}" data-location="${location}">Drop Item</button>`;
    actionsHtml += '</div>';
    
    // Sell info display
    let sellInfoHtml = '';
    if (sellInfo.canSell) {
        sellInfoHtml = `
            <div class="sell-info">
                <div class="sell-info-label">Sell Value</div>
                <div class="sell-info-price">${formatPrice(sellInfo.priceInGp)}</div>
                <div class="sell-info-note">${sellInfo.note}</div>
            </div>
        `;
    } else if (sellInfo.reason) {
        sellInfoHtml = `<div class="no-sell-reason">${sellInfo.reason}</div>`;
    }
    
    document.getElementById('itemModalBody').innerHTML = `
        <div class="item-detail-header">
            <div class="item-detail-icon-placeholder">${getTypeIcon(item.type)}</div>
            <div>
                <h2 class="item-detail-name">${item.name}</h2>
                <div class="item-detail-type">${item.type || 'Item'}</div>
                ${item.magical ? '<div class="item-detail-rarity rarity-uncommon">Magical</div>' : ''}
            </div>
        </div>
        ${item.attunement ? `<div class="item-attunement">${isAttuned ? '✓ Attuned' : 'Requires Attunement'}</div>` : ''}
        ${item.damage ? `
        <div class="item-stats">
            <div class="item-stat"><span class="item-stat-label">Damage</span><span class="item-stat-value">${item.damage} ${item.damageType || ''}</span></div>
            ${item.ac ? `<div class="item-stat"><span class="item-stat-label">AC</span><span class="item-stat-value">${item.ac}</span></div>` : ''}
        </div>` : ''}
        ${item.ac && !item.damage ? `
        <div class="item-stats">
            <div class="item-stat"><span class="item-stat-label">AC</span><span class="item-stat-value">${item.ac}</span></div>
        </div>` : ''}
        ${item.properties ? `<div class="item-properties">${item.properties.map(p => `<span class="item-property">${p}</span>`).join('')}</div>` : ''}
        ${item.effect ? `<div class="item-effect"><strong>Effect:</strong> ${item.effect}</div>` : ''}
        ${sellInfoHtml}
        ${actionsHtml}
    `;
    
    openModal('itemModal');
}

// Inventory Actions
async function equipItem(itemId) {
    const char = currentCharacter;
    const item = char.equipment.find(i => i.id === itemId);
    if (item) {
        item.equipped = true;
        renderInventory();
        renderWeapons();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast(`${item.name} equipped`);
    }
}

async function unequipItem(itemId) {
    const char = currentCharacter;
    const item = char.equipment.find(i => i.id === itemId);
    if (item) {
        item.equipped = false;
        renderInventory();
        renderWeapons();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast(`${item.name} unequipped`);
    }
}

async function moveToBackpack(itemId) {
    const char = currentCharacter;
    const itemIndex = char.equipment.findIndex(i => i.id === itemId);
    if (itemIndex > -1) {
        const item = char.equipment.splice(itemIndex, 1)[0];
        item.equipped = false;
        // Remove from attunement if attuned
        if (char.attunement) {
            char.attunement.slots = char.attunement.slots.map(s => s === itemId ? null : s);
        }
        char.backpack.push(item);
        renderInventory();
        renderWeapons();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast(`${item.name} moved to backpack`);
    }
}

async function moveToEquipment(itemId) {
    const char = currentCharacter;
    const itemIndex = char.backpack.findIndex(i => i.id === itemId);
    if (itemIndex > -1) {
        const item = char.backpack.splice(itemIndex, 1)[0];
        item.equipped = false;
        char.equipment.push(item);
        renderInventory();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast(`${item.name} moved to equipment`);
    }
}

async function attuneItem(itemId) {
    const char = currentCharacter;
    if (!char.attunement) char.attunement = { max: 3, slots: [null, null, null] };
    
    const emptySlotIndex = char.attunement.slots.findIndex(s => s === null);
    if (emptySlotIndex > -1) {
        char.attunement.slots[emptySlotIndex] = itemId;
        renderInventory();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast('Item attuned!');
    }
}

async function unattuneItem(itemId) {
    const char = currentCharacter;
    if (char.attunement) {
        char.attunement.slots = char.attunement.slots.map(s => s === itemId ? null : s);
        renderInventory();
        await syncCharacterToFirebase(char);
        closeModal('itemModal');
        showToast('Attunement broken');
    }
}

async function dropItem(itemId, location) {
    if (!confirm('Drop this item? It will be removed from your inventory.')) return;
    
    const char = currentCharacter;
    if (location === 'equipment') {
        const index = char.equipment.findIndex(i => i.id === itemId);
        if (index > -1) {
            const item = char.equipment.splice(index, 1)[0];
            // Remove from attunement
            if (char.attunement) {
                char.attunement.slots = char.attunement.slots.map(s => s === itemId ? null : s);
            }
            showToast(`${item.name} dropped`);
        }
    } else {
        const index = char.backpack.findIndex(i => i.id === itemId);
        if (index > -1) {
            const item = char.backpack.splice(index, 1)[0];
            showToast(`${item.name} dropped`);
        }
    }
    
    renderInventory();
    renderWeapons();
    await syncCharacterToFirebase(char);
    closeModal('itemModal');
}

// ============================================
// SELLING SYSTEM
// ============================================

// Calculate sell price based on item and current settlement
function calculateSellPrice(item) {
    // Get the item's original price from shop data
    let originalPrice = 0;
    let shopItem = null;
    
    // Try to find by shopItemId
    if (item.shopItemId && shopData?.items) {
        shopItem = shopData.items.find(si => si.id === item.shopItemId);
    }
    
    // Or try to find by name
    if (!shopItem && shopData?.items) {
        shopItem = shopData.items.find(si => si.name.toLowerCase() === item.name.toLowerCase());
    }
    
    if (shopItem) {
        originalPrice = shopItem.price_gp || 0;
    }
    
    // If no price found, can't sell
    if (originalPrice <= 0) {
        return {
            canSell: false,
            reason: "This item has no resale value"
        };
    }
    
    // Get current settlement from shop dropdown
    const settlementId = document.getElementById('shopProvince')?.value;
    if (!settlementId || settlementId === 'all') {
        return {
            canSell: false,
            reason: "Select a settlement in the Shop tab to sell items"
        };
    }
    
    // Find settlement
    const settlement = shopData?.settlements?.find(s => s.id === settlementId);
    if (!settlement) {
        return {
            canSell: false,
            reason: "No shop available"
        };
    }
    
    // Get the shops in this settlement (it's called 'shops' not 'shop_types')
    const settlementShops = settlement.shops || [];
    
    // Get the shop types that sell this item
    const itemShopTypes = shopItem?.shop_types || [];
    
    // Find matching shop
    let sellPercentage = 0;
    let shopName = '';
    
    // Check for matching shop type (item is sold at this type of shop)
    for (const shopType of itemShopTypes) {
        if (settlementShops.includes(shopType)) {
            // Found a matching shop!
            const shopInfo = shopData.shopTypes?.find(st => st.id === shopType);
            shopName = shopInfo?.name || shopType;
            sellPercentage = 0.5; // 50% at matching shop
            break;
        }
    }
    
    // If no matching shop, check for general store or black market
    if (sellPercentage === 0) {
        if (settlementShops.includes('black_market')) {
            sellPercentage = 0.4; // 40% at black market (they buy anything)
            shopName = 'Black Market';
        } else if (settlementShops.includes('general')) {
            sellPercentage = 0.25; // 25% at general store
            shopName = 'General Store';
        }
    }
    
    if (sellPercentage === 0) {
        return {
            canSell: false,
            reason: `No shop in ${settlement.name} will buy this item`
        };
    }
    
    const sellPrice = originalPrice * sellPercentage;
    
    return {
        canSell: true,
        priceInGp: sellPrice,
        percentage: sellPercentage * 100,
        note: `${shopName} pays ${sellPercentage * 100}% (${formatPrice(originalPrice)} value)`
    };
}

// Sell an item
async function sellItem(itemId, location, priceInGp) {
    const char = currentCharacter;
    let item;
    let index;
    
    if (location === 'equipment') {
        index = char.equipment.findIndex(i => i.id === itemId);
        if (index > -1) {
            item = char.equipment[index];
        }
    } else {
        index = char.backpack.findIndex(i => i.id === itemId);
        if (index > -1) {
            item = char.backpack[index];
        }
    }
    
    if (!item) return;
    
    // Confirm sale
    if (!confirm(`Sell ${item.name} for ${formatPrice(priceInGp)}?`)) return;
    
    // Add money to currency (in GP, SP, CP)
    addGold(char.currency, priceInGp);
    
    // Remove item
    if (location === 'equipment') {
        char.equipment.splice(index, 1);
        // Remove from attunement if attuned
        if (char.attunement) {
            char.attunement.slots = char.attunement.slots.map(s => s === itemId ? null : s);
        }
    } else {
        char.backpack.splice(index, 1);
    }
    
    // Update displays
    renderInventory();
    renderWeapons();
    renderShop();
    updateCoinPurseDisplay();
    
    await syncCharacterToFirebase(char);
    
    closeModal('itemModal');
    showToast(`Sold ${item.name} for ${formatPrice(priceInGp)}!`);
}

// Add gold to currency (distributes into GP, SP, CP)
function addGold(currency, amountInGp) {
    // Convert to copper
    const amountInCopper = Math.round(amountInGp * 100);
    
    // Distribute into denominations
    const gpToAdd = Math.floor(amountInCopper / 100);
    const remainder = amountInCopper % 100;
    const spToAdd = Math.floor(remainder / 10);
    const cpToAdd = remainder % 10;
    
    currency.gp = (currency.gp || 0) + gpToAdd;
    currency.sp = (currency.sp || 0) + spToAdd;
    currency.cp = (currency.cp || 0) + cpToAdd;
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
// SHOP TAB - Full Featured with Buy/Sell
// ============================================
function renderShop() {
    const char = currentCharacter;
    document.getElementById('shopGold').textContent = formatCurrency(char.currency);
    document.getElementById('wishlistCount').textContent = wishlist.size;
    
    // Populate settlement dropdown if not done
    const settlementSelect = document.getElementById('shopProvince');
    if (settlementSelect.options.length <= 1) {
        populateSettlementDropdown();
    }
    
    // Update mode toggle buttons
    document.getElementById('shopModeBuy').classList.toggle('active', shopMode === 'buy');
    document.getElementById('shopModeSell').classList.toggle('active', shopMode === 'sell');
    
    // Show/hide appropriate filters
    document.getElementById('buyFilters').style.display = shopMode === 'buy' ? 'flex' : 'none';
    document.getElementById('sellInfo').style.display = shopMode === 'sell' ? 'block' : 'none';
    
    // Update sell info text
    const settlementId = settlementSelect.value;
    if (shopMode === 'sell') {
        const settlement = shopData?.settlements?.find(s => s.id === settlementId);
        if (settlement) {
            const shopNames = (settlement.shops || []).map(shopId => {
                const shopInfo = shopData.shopTypes?.find(st => st.id === shopId);
                return shopInfo?.name || shopId;
            }).join(', ');
            document.getElementById('sellInfo').innerHTML = `<span class="sell-mode-hint">Selling at <strong>${settlement.name}</strong> (${shopNames})</span>`;
        } else {
            document.getElementById('sellInfo').innerHTML = `<span class="sell-mode-hint">Select a settlement to see sell prices</span>`;
        }
    }
    
    if (shopMode === 'buy') {
        renderBuyMode();
    } else {
        renderSellMode();
    }
}

function renderBuyMode() {
    const char = currentCharacter;
    const settlementId = document.getElementById('shopProvince').value;
    const category = document.getElementById('shopCategory').value;
    
    // Get available items based on settlement
    let items = getAvailableItems(settlementId, category);
    
    // Filter by wishlist if toggled
    if (showingWishlistOnly) {
        items = items.filter(item => wishlist.has(item.id.toString()));
    }
    
    // Sort by rarity then price
    const rarityOrder = { 'Common': 0, 'Uncommon': 1, 'Rare': 2, 'Very Rare': 3, 'Legendary': 4 };
    items.sort((a, b) => {
        const rarityDiff = (rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0);
        if (rarityDiff !== 0) return rarityDiff;
        return (a.price_gp || 0) - (b.price_gp || 0);
    });
    
    document.getElementById('shopList').innerHTML = items.map(item => {
        const owned = isItemOwned(item);
        const affordable = canAfford(char.currency, item.price_gp || 0);
        const isWishlisted = wishlist.has(item.id.toString());
        const icon = getItemIcon(item);
        
        return `
            <div class="shop-item ${owned ? 'owned' : ''} ${!affordable && !owned ? 'cant-afford' : ''}" data-item-id="${item.id}">
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${item.id}">★</button>
                <img src="${ICON_BASE}/${icon}.svg?color=${ICON_COLOR}" alt="" class="shop-item-icon">
                <div class="shop-item-info">
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-type rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity} ${item.category}</div>
                </div>
                <div class="shop-item-price">
                    ${owned ? '<span class="owned-badge">Owned</span>' : `<span class="price">${formatPrice(item.price_gp || 0)}</span>`}
                </div>
            </div>
        `;
    }).join('') || '<div class="no-items">No items available at this location</div>';
}

function renderSellMode() {
    const char = currentCharacter;
    
    // Get all items from equipment and backpack
    const allItems = [
        ...(char.equipment || []).map(item => ({ ...item, location: 'equipment' })),
        ...(char.backpack || []).map(item => ({ ...item, location: 'backpack' }))
    ];
    
    if (allItems.length === 0) {
        document.getElementById('shopList').innerHTML = '<div class="no-items">No items to sell</div>';
        return;
    }
    
    document.getElementById('shopList').innerHTML = allItems.map(item => {
        const sellInfo = calculateSellPrice(item);
        const icon = getTypeIcon(item.type);
        
        return `
            <div class="sell-item" data-item-id="${item.id}" data-location="${item.location}" data-can-sell="${sellInfo.canSell}" data-price="${sellInfo.priceInGp || 0}">
                <div class="sell-item-icon">${icon}</div>
                <div class="sell-item-info">
                    <div class="sell-item-name ${item.magical ? 'magical' : ''}">${item.name}${item.magical ? ' ✦' : ''}</div>
                    <div class="sell-item-type">${item.type || 'Item'}${item.equipped ? ' • Equipped' : ''}</div>
                </div>
                <div class="sell-item-price">
                    ${sellInfo.canSell 
                        ? `<span class="price">${formatPrice(sellInfo.priceInGp)}</span>` 
                        : `<span class="no-sell">Can't sell</span>`}
                </div>
            </div>
        `;
    }).join('');
}

function setShopMode(mode) {
    shopMode = mode;
    renderShop();
}

function populateSettlementDropdown() {
    const select = document.getElementById('shopProvince');
    select.innerHTML = '<option value="all">🌍 All Settlements</option>';
    
    if (!shopData?.settlements) return;
    
    // Group by province
    const provinces = {};
    shopData.settlements.forEach(s => {
        const prov = s.province || 'Unknown';
        if (!provinces[prov]) provinces[prov] = [];
        provinces[prov].push(s);
    });
    
    Object.entries(provinces).forEach(([province, settlements]) => {
        const group = document.createElement('optgroup');
        group.label = province;
        settlements.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            group.appendChild(option);
        });
        select.appendChild(group);
    });
}

function getAvailableItems(settlementId, category) {
    if (!shopData?.items) return [];
    
    let items = [...shopData.items];
    
    // Filter by settlement's available shop types
    if (settlementId && settlementId !== 'all') {
        const settlement = shopData.settlements.find(s => s.id === settlementId);
        if (settlement) {
            currentSettlement = settlement;
            const availableShopTypes = settlement.shops || [];
            items = items.filter(item => {
                const itemShopTypes = item.shop_types || [];
                return itemShopTypes.some(st => availableShopTypes.includes(st));
            });
        }
    } else {
        currentSettlement = null;
    }
    
    // Filter by category
    if (category && category !== 'all') {
        items = items.filter(item => {
            const cat = (item.category || '').toLowerCase();
            if (category === 'weapon') return cat.includes('weapon');
            if (category === 'armor') return cat.includes('armor') || cat.includes('shield');
            if (category === 'potion') return cat.includes('potion');
            if (category === 'scroll') return cat.includes('scroll');
            if (category === 'wondrous') return cat.includes('wondrous') || cat.includes('magical');
            if (category === 'gear') return cat.includes('gear') || cat.includes('supplies') || cat.includes('tools');
            if (category === 'contraband') return cat.includes('contraband') || cat.includes('poison');
            return true;
        });
    }
    
    return items;
}

function getItemIcon(item) {
    // Try to get icon from icons.json mapping or item itself
    if (item.icon) return item.icon;
    
    // Default icons by category
    const categoryIcons = {
        'Weapons': 'crossed-swords',
        'Armor': 'leather-armor',
        'Shields': 'shield',
        'Potions': 'potion-ball',
        'Poisons': 'poison-bottle',
        'Scrolls': 'scroll-unfurled',
        'Adventuring Gear': 'backpack',
        'Supplies': 'bindle',
        'Tools': 'hammer-nails',
        'Wondrous Items': 'sparkles',
        'Holy Items': 'ankh',
        'Contraband': 'hooded-figure'
    };
    
    return categoryIcons[item.category] || 'swap-bag';
}

function isItemOwned(item) {
    // Check if character already owns this item
    const char = currentCharacter;
    if (!char) return false;
    
    // Check inventory
    return char.inventory?.some(inv => 
        inv.name.toLowerCase() === item.name.toLowerCase()
    ) || false;
}

function showShopItemDetail(itemId) {
    const item = shopData?.items?.find(i => i.id == itemId);
    if (!item) return;
    
    const char = currentCharacter;
    const owned = isItemOwned(item);
    const affordable = canAfford(char.currency, item.price_gp || 0);
    const isWishlisted = wishlist.has(item.id.toString());
    const icon = getItemIcon(item);
    
    // Build properties display
    const props = item.properties || [];
    const propsHtml = props.length > 0 
        ? `<div class="item-properties">${props.map(p => `<span class="item-property">${p}</span>`).join('')}</div>` 
        : '';
    
    // Build tags display
    const tags = item.tags || [];
    const tagsHtml = tags.length > 0 
        ? `<div class="item-tags">${tags.map(t => `<span class="item-tag">${t}</span>`).join('')}</div>` 
        : '';
    
    // Shop availability
    const shopTypes = item.shop_types || [];
    const shopsHtml = shopTypes.length > 0 
        ? `<div class="item-shops"><span class="shops-label">Available at:</span> ${shopTypes.map(st => {
            const shop = shopData.shopTypes?.find(s => s.id === st);
            return shop ? `<span class="shop-type">${shop.icon || ''} ${shop.name}</span>` : st;
        }).join(', ')}</div>`
        : '';
    
    document.getElementById('shopModalBody').innerHTML = `
        <div class="item-detail-header">
            <img src="${ICON_BASE}/${icon}.svg?color=${ICON_COLOR}" alt="" class="item-detail-icon">
            <div>
                <h2 class="item-detail-name">${item.name}</h2>
                <div class="item-detail-type">${item.category}${item.type ? ` (${item.type})` : ''}</div>
                <div class="item-detail-rarity rarity-${item.rarity.toLowerCase().replace(' ', '-')}">${item.rarity}</div>
            </div>
        </div>
        <div class="shop-item-cost">
            <span class="cost-label">Price:</span>
            <span class="cost-value">${formatPrice(item.price_gp || 0)}</span>
        </div>
        ${item.damage ? `<div class="item-stats">
            <div class="item-stat"><span class="item-stat-label">Damage</span><span class="item-stat-value">${item.damage}</span></div>
            ${item.ac ? `<div class="item-stat"><span class="item-stat-label">AC</span><span class="item-stat-value">${item.ac}</span></div>` : ''}
        </div>` : ''}
        ${item.ac && !item.damage ? `<div class="item-stats">
            <div class="item-stat"><span class="item-stat-label">AC</span><span class="item-stat-value">${item.ac}</span></div>
        </div>` : ''}
        ${propsHtml}
        <div class="item-description">${item.description || 'No description available.'}</div>
        ${item.effect ? `<div class="item-effect"><strong>Effect:</strong> ${item.effect}</div>` : ''}
        ${tagsHtml}
        ${shopsHtml}
        <div class="shop-actions">
            <button class="shop-btn wishlist ${isWishlisted ? 'active' : ''}" data-wishlist-id="${item.id}">
                ${isWishlisted ? '★ On Wishlist' : '☆ Add to Wishlist'}
            </button>
            ${owned 
                ? '<button class="shop-btn owned" disabled>Already Owned</button>'
                : affordable 
                    ? `<button class="shop-btn buy" data-item-id="${item.id}">Buy for ${formatPrice(item.price_gp || 0)}</button>`
                    : `<button class="shop-btn cant-afford" disabled>Can't Afford</button>`
            }
        </div>
    `;
    
    openModal('shopModal');
}

async function buyItem(itemId) {
    const item = shopData?.items?.find(i => i.id == itemId);
    const char = currentCharacter;
    
    if (!item || !canAfford(char.currency, item.price_gp || 0)) return;
    
    // Close shop modal and show purchase choice modal
    closeModal('shopModal');
    showPurchaseChoiceModal(item);
}

function showPurchaseChoiceModal(item) {
    // Create the item object for inventory
    const newItem = createItemFromShopItem(item);
    
    document.getElementById('itemModalBody').innerHTML = `
        <div class="purchase-choice">
            <div class="purchase-header">
                <h2>Purchased!</h2>
                <div class="purchase-item-name">${item.name}</div>
                <div class="purchase-cost">-${formatPrice(item.price_gp || 0)}</div>
            </div>
            <p class="purchase-prompt">Where do you want to put it?</p>
            <div class="purchase-actions">
                <button class="purchase-btn equip-btn" data-item-id="${item.id}">
                    <span class="purchase-btn-icon">⚔️</span>
                    <span class="purchase-btn-text">Equip Now</span>
                </button>
                <button class="purchase-btn backpack-btn" data-item-id="${item.id}">
                    <span class="purchase-btn-icon">🎒</span>
                    <span class="purchase-btn-text">Add to Backpack</span>
                </button>
            </div>
        </div>
    `;
    
    openModal('itemModal');
}

function createItemFromShopItem(shopItem) {
    // Convert shop item to equipment/inventory item format
    const itemType = getItemTypeFromCategory(shopItem.category);
    
    const newItem = {
        id: `purchased-${Date.now()}`,
        name: shopItem.name,
        type: itemType,
        weight: shopItem.weight || 0,
        qty: 1,
        shopItemId: shopItem.id
    };
    
    // Add weapon properties
    if (shopItem.damage) {
        newItem.damage = shopItem.damage;
        newItem.damageType = shopItem.damage_type || extractDamageType(shopItem.damage);
    }
    
    // Add armor properties
    if (shopItem.ac) {
        newItem.ac = shopItem.ac;
    }
    
    // Add properties array
    if (shopItem.properties) {
        newItem.properties = shopItem.properties;
    }
    
    // Check if magical
    if (shopItem.rarity && shopItem.rarity !== 'Common') {
        newItem.magical = true;
    }
    
    // Check for attunement
    if (shopItem.properties?.some(p => p.toLowerCase().includes('attunement'))) {
        newItem.attunement = true;
    }
    
    // Add effect/description
    if (shopItem.effect) {
        newItem.effect = shopItem.effect;
    }
    
    return newItem;
}

function getItemTypeFromCategory(category) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('weapon')) return 'weapon';
    if (cat.includes('armor')) return 'armor';
    if (cat.includes('shield')) return 'shield';
    if (cat.includes('potion')) return 'potion';
    if (cat.includes('scroll')) return 'scroll';
    if (cat.includes('wondrous')) return 'wondrous';
    if (cat.includes('tool')) return 'tool';
    return 'gear';
}

function extractDamageType(damageStr) {
    const types = ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'thunder', 'poison', 'acid', 'necrotic', 'radiant', 'force', 'psychic'];
    const lower = (damageStr || '').toLowerCase();
    for (const type of types) {
        if (lower.includes(type)) return type;
    }
    return '';
}

async function completePurchase(shopItemId, destination) {
    const item = shopData?.items?.find(i => i.id == shopItemId);
    const char = currentCharacter;
    
    if (!item) return;
    
    // Deduct gold using proper currency conversion
    if (!deductGold(char.currency, item.price_gp || 0)) {
        showToast('Not enough gold!');
        return;
    }
    
    // Create the new item
    const newItem = createItemFromShopItem(item);
    
    // Add to appropriate location
    if (destination === 'equipment') {
        newItem.equipped = true;
        char.equipment = char.equipment || [];
        char.equipment.push(newItem);
    } else {
        char.backpack = char.backpack || [];
        char.backpack.push(newItem);
    }
    
    // Update displays
    renderShop();
    renderInventory();
    renderWeapons();
    updateCoinPurseDisplay();
    
    await syncCharacterToFirebase(char);
    
    closeModal('itemModal');
    
    const destText = destination === 'equipment' ? 'equipped' : 'added to backpack';
    showToast(`${item.name} ${destText}!`);
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
    
    // Coin Purse
    document.getElementById('coinPurse').addEventListener('click', openCoinPurse);
    document.getElementById('closeCoinPurse').addEventListener('click', closeCoinPurse);
    document.getElementById('coinPurseModal').addEventListener('click', (e) => {
        if (e.target.id === 'coinPurseModal') closeCoinPurse();
    });
    
    // DM Currency Editing
    document.getElementById('dmEditCurrencyBtn').addEventListener('click', enterCurrencyEditMode);
    document.getElementById('cancelCurrencyEdit').addEventListener('click', cancelCurrencyEdit);
    document.getElementById('saveCurrencyEdit').addEventListener('click', saveCurrencyEdit);
    
    // Currency +/- buttons
    document.querySelectorAll('.coin-btn.plus').forEach(btn => {
        btn.addEventListener('click', () => adjustCurrency(btn.dataset.currency, 1));
    });
    document.querySelectorAll('.coin-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => adjustCurrency(btn.dataset.currency, -1));
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
        const card = e.target.closest('.weapon-card');
        if (card) {
            showInventoryItemModal(card.dataset.itemId, 'equipment');
        }
    });
    
    // Inventory/Gear clicks
    document.getElementById('inventoryList').addEventListener('click', (e) => {
        const item = e.target.closest('.inv-item');
        if (item) {
            showInventoryItemModal(item.dataset.itemId, item.dataset.location);
        }
    });
    
    // Item modal action buttons (delegated)
    document.getElementById('itemModalBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.item-action-btn');
        if (btn) {
            const itemId = btn.dataset.itemId;
            const location = btn.dataset.location;
            
            if (btn.classList.contains('equip')) equipItem(itemId);
            else if (btn.classList.contains('unequip')) unequipItem(itemId);
            else if (btn.classList.contains('to-backpack')) moveToBackpack(itemId);
            else if (btn.classList.contains('to-equipment')) moveToEquipment(itemId);
            else if (btn.classList.contains('attune')) attuneItem(itemId);
            else if (btn.classList.contains('unattune')) unattuneItem(itemId);
            else if (btn.classList.contains('drop')) dropItem(itemId, location);
            else if (btn.classList.contains('sell')) {
                const price = parseFloat(btn.dataset.price);
                sellItem(itemId, location, price);
            }
            return;
        }
        
        // Purchase choice buttons
        const purchaseBtn = e.target.closest('.purchase-btn');
        if (purchaseBtn) {
            const shopItemId = parseInt(purchaseBtn.dataset.itemId);
            if (purchaseBtn.classList.contains('equip-btn')) {
                completePurchase(shopItemId, 'equipment');
            } else if (purchaseBtn.classList.contains('backpack-btn')) {
                completePurchase(shopItemId, 'backpack');
            }
        }
    });
    
    // Shop clicks
    document.getElementById('shopList').addEventListener('click', (e) => {
        // Wishlist button (buy mode only)
        const wishlistBtn = e.target.closest('.wishlist-btn');
        if (wishlistBtn) {
            e.stopPropagation();
            toggleWishlist(wishlistBtn.dataset.wishlistId);
            return;
        }
        
        // Buy mode - Item card
        const buyCard = e.target.closest('.shop-item');
        if (buyCard) {
            showShopItemDetail(buyCard.dataset.itemId);
            return;
        }
        
        // Sell mode - Sell item
        const sellCard = e.target.closest('.sell-item');
        if (sellCard) {
            const canSell = sellCard.dataset.canSell === 'true';
            if (canSell) {
                const itemId = sellCard.dataset.itemId;
                const location = sellCard.dataset.location;
                const price = parseFloat(sellCard.dataset.price);
                sellItem(itemId, location, price);
            } else {
                showToast("Can't sell this item here");
            }
            return;
        }
    });
    
    // Shop mode toggle
    document.getElementById('shopModeBuy').addEventListener('click', () => setShopMode('buy'));
    document.getElementById('shopModeSell').addEventListener('click', () => setShopMode('sell'));
    
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
