// ============================================
// SCARLETT ISLES SHOP - JavaScript
// Weekly rotating shop for D&D Beyond companion
// ============================================

// Game-icons.net SVG format: https://game-icons.net/icons/ffffff/000000/1x1/lorc/icon-name.svg
const ICON_BASE = 'https://game-icons.net/icons/ffffff/000000/1x1';

// Icon mapping - all icons from game-icons.net by various artists
const ICON_MAP = {
    'health-potion': 'delapouite/health-potion',
    'arrow-cluster': 'lorc/arrow-cluster',
    'lockpicks': 'delapouite/lockpicks',
    'grappling-hook': 'lorc/grappling-hook',
    'first-aid': 'delapouite/first-aid',
    'potion-ball': 'lorc/potion-ball',
    'poison-bottle': 'lorc/poison-bottle',
    'smoking-orb': 'lorc/smoking-orb',
    'caltrops': 'lorc/caltrops',
    'bear-trap': 'lorc/bear-trap',
    'bottle-vapors': 'lorc/bottle-vapors',
    'stones': 'lorc/stones',
    'rope-coil': 'delapouite/rope-coil',
    'acid': 'lorc/acid',
    'fire-bottle': 'lorc/molotov',
    'hooded-assassin': 'lorc/hooded-assassin',
    'bracer': 'lorc/bracer',
    'leg-armor': 'lorc/leg-armor',
    'gauntlet': 'lorc/gauntlet',
    'cape': 'lorc/cape',
    'swap-bag': 'lorc/swap-bag',
    'sword-hilt': 'lorc/sword-hilt',
    'pocket-bow': 'lorc/pocket-bow',
    'dripping-blade': 'lorc/dripping-blade',
    'flaming-sword': 'lorc/flaming-sword',
    'bow-arrow': 'lorc/bow-arrow',
    'ring': 'lorc/ring',
    'scythe': 'lorc/scythe',
    'invisible': 'lorc/invisible',
    'crossed-swords': 'lorc/crossed-swords',
    'leather-armor': 'lorc/leather-armor'
};

let itemsData = null;
let currentCategory = 'all';
let currentRarity = 'all';

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    try {
        const response = await fetch('items.json');
        itemsData = await response.json();
        
        updateWeekNumber();
        renderItems();
        setupEventListeners();
        
    } catch (err) {
        console.error('Failed to load items:', err);
        document.getElementById('itemsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p>Failed to load shop items</p>
            </div>
        `;
    }
}

// ============================================
// WEEK NUMBER CALCULATION
// ============================================
function getWeekNumber() {
    // Calculate week number since a fixed start date
    // This ensures everyone sees the same items
    const startDate = new Date('2025-01-06'); // A Monday
    const now = new Date();
    const diffTime = now - startDate;
    const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
    return diffWeeks + 1;
}

function updateWeekNumber() {
    document.getElementById('weekNumber').textContent = getWeekNumber();
}

// ============================================
// SEEDED RANDOM - Same items for everyone each week
// ============================================
function seededRandom(seed) {
    // Simple seeded random number generator
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function shuffleWithSeed(array, seed) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getWeeklyItems() {
    if (!itemsData) return [];
    
    const weekNum = getWeekNumber();
    const seed = weekNum * 12345; // Unique seed per week
    
    // Group items by rarity
    const byRarity = {
        common: itemsData.items.filter(i => i.rarity === 'common'),
        uncommon: itemsData.items.filter(i => i.rarity === 'uncommon'),
        rare: itemsData.items.filter(i => i.rarity === 'rare'),
        legendary: itemsData.items.filter(i => i.rarity === 'legendary')
    };
    
    // Shuffle each rarity group with the week seed
    const shuffledCommon = shuffleWithSeed(byRarity.common, seed);
    const shuffledUncommon = shuffleWithSeed(byRarity.uncommon, seed + 1000);
    const shuffledRare = shuffleWithSeed(byRarity.rare, seed + 2000);
    const shuffledLegendary = shuffleWithSeed(byRarity.legendary, seed + 3000);
    
    // Pick items based on weekly count
    const counts = itemsData.meta.weeklyItemCount;
    const weeklyItems = [
        ...shuffledCommon.slice(0, counts.common),
        ...shuffledUncommon.slice(0, counts.uncommon),
        ...shuffledRare.slice(0, counts.rare),
        ...shuffledLegendary.slice(0, counts.legendary)
    ];
    
    return weeklyItems;
}

// ============================================
// RENDER ITEMS
// ============================================
function renderItems() {
    const items = getWeeklyItems();
    const grid = document.getElementById('itemsGrid');
    
    // Filter by category
    let filtered = items;
    if (currentCategory !== 'all') {
        filtered = filtered.filter(item => item.type === currentCategory);
    }
    
    // Filter by rarity
    if (currentRarity !== 'all') {
        filtered = filtered.filter(item => item.rarity === currentRarity);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No items match your filters</p>
            </div>
        `;
        return;
    }
    
    // Sort by rarity (legendary first) then by name
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    filtered.sort((a, b) => {
        const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        return a.name.localeCompare(b.name);
    });
    
    grid.innerHTML = filtered.map(item => renderItemCard(item)).join('');
}

function renderItemCard(item) {
    const icon = getItemIcon(item);
    const priceStr = formatPrice(item.price);
    
    // Show first 2 classes this is good for
    const goodFor = item.goodFor.slice(0, 2).map(cls => 
        `<span class="class-tag">${cls}</span>`
    ).join('');
    
    return `
        <div class="item-card ${item.rarity}" data-item-id="${item.id}">
            <span class="item-star">☆</span>
            <img src="${ICON_BASE}/${icon}.svg" alt="" class="item-icon" onerror="this.style.opacity='0.3'">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-meta">${item.category}</div>
                <div class="item-good-for">${goodFor}</div>
            </div>
            <div class="item-price">${priceStr}</div>
        </div>
    `;
}

function getItemIcon(item) {
    // Use the icon specified in the item, mapped to full path
    if (item.icon && ICON_MAP[item.icon]) {
        return ICON_MAP[item.icon];
    }
    
    // Fallback icons by type
    const typeIcons = {
        weapon: 'lorc/crossed-swords',
        armor: 'lorc/leather-armor',
        gear: 'lorc/swap-bag'
    };
    
    return typeIcons[item.type] || 'lorc/swap-bag';
}

function formatPrice(gp) {
    if (gp >= 1000) {
        return `${(gp / 1000).toFixed(gp % 1000 === 0 ? 0 : 1)}k gp`;
    }
    return `${gp} gp`;
}

// ============================================
// ITEM MODAL
// ============================================
function showItemModal(itemId) {
    const items = getWeeklyItems();
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const modal = document.getElementById('itemModal');
    const body = document.getElementById('modalBody');
    
    const icon = getItemIcon(item);
    
    // Find which party members this is good for
    const goodForParty = itemsData.party.filter(p => 
        item.goodFor.includes(p.class)
    );
    
    body.innerHTML = `
        <div class="modal-header">
            <div class="modal-header-content">
                <img src="${ICON_BASE}/${icon}.svg" alt="" class="modal-icon">
                <div class="modal-title-area">
                    <h2 class="modal-item-name ${item.rarity}">${item.name}</h2>
                    <div class="modal-item-category">${item.category}</div>
                    <span class="modal-item-rarity ${item.rarity}">${item.rarity}${item.attunement ? ' • Requires Attunement' : ''}</span>
                </div>
            </div>
        </div>
        
        <div class="modal-body">
            <div class="modal-section">
                <div class="modal-section-title">Description</div>
                <p class="modal-description">${item.description}</p>
            </div>
            
            ${item.damage ? `
                <div class="modal-section">
                    <div class="modal-stats">
                        <div class="modal-stat">
                            <div class="modal-stat-label">Damage</div>
                            <div class="modal-stat-value">${item.damage}</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            ${item.properties && item.properties.length > 0 ? `
                <div class="modal-section">
                    <div class="modal-section-title">Properties</div>
                    <div class="modal-properties">
                        ${item.properties.map(p => `<span class="property-tag">${p}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${item.effect ? `
                <div class="modal-section">
                    <div class="modal-section-title">Effect</div>
                    <div class="modal-effect">${item.effect}</div>
                </div>
            ` : ''}
            
            <div class="modal-section">
                <div class="modal-section-title">Great For</div>
                <div class="modal-good-for">
                    ${goodForParty.map(p => `
                        <span class="good-for-tag">
                            <span class="char-name">${p.name.split(' ')[0]}</span>
                            (${p.class})
                        </span>
                    `).join('')}
                </div>
            </div>
            
            <div class="modal-section">
                <div class="modal-price">
                    <span class="modal-price-label">Price</span>
                    <span class="modal-price-value">${item.price.toLocaleString()} gp</span>
                </div>
                <p class="modal-price-note">Add this item to D&D Beyond manually after purchasing in-game</p>
            </div>
        </div>
    `;
    
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            renderItems();
        });
    });
    
    // Rarity filter
    document.querySelectorAll('.rarity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRarity = btn.dataset.rarity;
            renderItems();
        });
    });
    
    // Item clicks
    document.getElementById('itemsGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (card) {
            showItemModal(parseInt(card.dataset.itemId));
        }
    });
    
    // Modal close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('itemModal').addEventListener('click', (e) => {
        if (e.target.id === 'itemModal') closeModal();
    });
    
    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// Start the app
init();
