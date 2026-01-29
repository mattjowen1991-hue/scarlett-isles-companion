/* ===================================
   THE SCARLETT ISLES - KNIGHTLY TREASURES
   Shop Application Logic
   =================================== */

// ===================================
// CONFIGURATION
// ===================================

const CONFIG = {
    weekSeed: getWeekNumber(),
    itemsPerWeek: 30  // Show all items
};

function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 604800000;
    return Math.ceil(diff / oneWeek);
}

// ===================================
// SEEDED RANDOM (for consistent weekly inventory)
// ===================================

function seededRandom(seed) {
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

// ===================================
// ICON MAPPING
// ===================================

const ICON_MAP = {
    // Weapons - specific matches (check these first)
    'vorpal': 'bloody-sword',
    'holy avenger': 'winged-sword',
    'flame tongue': 'flaming-sword',
    'venom': 'dripping-blade',
    'magic missiles': 'missile-swarm',
    
    // Weapons - general
    'greatsword': 'broadsword',
    'longsword': 'broadsword',
    'shortsword': 'gladius',
    'rapier': 'rapier',
    'dagger': 'stiletto',
    'battleaxe': 'battle-axe',
    'handaxe': 'thrown-daggers',
    'warhammer': 'war-pick',
    'mace': 'flanged-mace',
    'quarterstaff': 'bo',
    'spear': 'spear-hook',
    'longbow': 'bow-arrow',
    'shortbow': 'high-shot',
    'crossbow': 'crossbow',
    
    // Armor
    'shield': 'round-shield',
    'chain shirt': 'mail-shirt',
    'chain': 'mail-shirt',
    'studded leather': 'leather-vest',
    'leather': 'leather-vest',
    'plate': 'breastplate',
    'bracers': 'forearm',
    'gauntlets': 'gloves',
    'gauntlet': 'gloves',
    'helmet': 'visored-helm',
    'helm': 'visored-helm',
    
    // Wearables
    'cloak': 'cape',
    'boots': 'leg-armor',
    'goggles': 'steampunk-goggles',
    'ring': 'ring',
    'amulet': 'emerald-necklace',
    'ioun': 'gem-pendant',
    
    // Magic items
    'staff of power': 'wizard-staff',
    'staff': 'wizard-staff',
    'wand': 'fairy-wand',
    'scroll': 'scroll-unfurled',
    'book': 'spell-book',
    'orb': 'crystal-ball',
    'lantern': 'lantern-flame',
    'decanter': 'drink-me',
    
    // Gear
    'potion': 'potion-ball',
    'bag': 'backpack',
    'rope': 'rope-coil',
    'torch': 'torch',
    'ball bearings': 'stone-pile',
    'bearings': 'stone-pile',
    
    // Default
    'default': 'swap-bag'
};

function getItemIcon(item) {
    const nameLower = item.name.toLowerCase();
    const typeLower = item.type.toLowerCase();
    
    // Check full name first for specific matches (longer keys first)
    const sortedKeys = Object.keys(ICON_MAP)
        .filter(k => k !== 'default')
        .sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        if (nameLower.includes(key)) {
            return `https://game-icons.net/icons/ffffff/000000/1x1/lorc/${ICON_MAP[key]}.svg`;
        }
    }
    
    // Then check type
    for (const key of sortedKeys) {
        if (typeLower.includes(key)) {
            return `https://game-icons.net/icons/ffffff/000000/1x1/lorc/${ICON_MAP[key]}.svg`;
        }
    }
    
    return `https://game-icons.net/icons/ffffff/000000/1x1/lorc/${ICON_MAP.default}.svg`;
}

// ===================================
// FORMAT HELPERS
// ===================================

function formatPrice(price) {
    if (price >= 1000) {
        return `${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}K`;
    }
    return price.toString();
}

function formatPriceFull(price) {
    return price.toLocaleString();
}

// ===================================
// STATE
// ===================================

let allItems = [];
let weeklyItems = [];
let currentCategory = 'all';
let currentRarity = 'all';
let favorites = JSON.parse(localStorage.getItem('tsi-favorites') || '[]');

// ===================================
// INITIALIZATION
// ===================================

async function init() {
    // Set week number
    const weekEl = document.getElementById('weekNumber');
    if (weekEl) {
        weekEl.textContent = CONFIG.weekSeed;
    }
    
    // Load items
    try {
        const response = await fetch('items.json');
        allItems = await response.json();
        
        // Get this week's selection
        weeklyItems = shuffleWithSeed(allItems, CONFIG.weekSeed).slice(0, CONFIG.itemsPerWeek);
        
        renderItems();
        setupEventListeners();
    } catch (error) {
        console.error('Failed to load items:', error);
        const itemList = document.getElementById('itemList');
        if (itemList) {
            itemList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <p class="empty-state-text">Failed to load shop inventory</p>
                </div>
            `;
        }
    }
}

// ===================================
// RENDERING
// ===================================

function renderItems() {
    const itemList = document.getElementById('itemList');
    if (!itemList) {
        console.error('itemList element not found');
        return;
    }
    
    // Filter items
    let filtered = weeklyItems.filter(item => {
        const categoryMatch = currentCategory === 'all' || item.category === currentCategory;
        const rarityMatch = currentRarity === 'all' || item.rarity.toLowerCase() === currentRarity;
        return categoryMatch && rarityMatch;
    });
    
    if (filtered.length === 0) {
        itemList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p class="empty-state-text">No items match your filters</p>
            </div>
        `;
        return;
    }
    
    // Sort by rarity (legendary first) then price
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    filtered.sort((a, b) => {
        const rarityDiff = rarityOrder[a.rarity.toLowerCase()] - rarityOrder[b.rarity.toLowerCase()];
        if (rarityDiff !== 0) return rarityDiff;
        return b.price - a.price;
    });
    
    itemList.innerHTML = filtered.map(item => {
        const rarity = item.rarity.toLowerCase();
        const isFavorite = favorites.includes(item.id);
        const iconUrl = getItemIcon(item);
        
        return `
            <div class="item-row ${rarity}" data-item-id="${item.id}">
                <span class="item-star ${isFavorite ? 'favorited' : ''}" data-item-id="${item.id}">
                    ${isFavorite ? '★' : '☆'}
                </span>
                <div class="item-icon">
                    <img src="${iconUrl}" alt="${item.name}" onerror="this.style.display='none'">
                </div>
                <div class="item-details">
                    <h3 class="item-name">${item.name}</h3>
                    <p class="item-type">${item.type}</p>
                    <div class="item-tags">
                        ${item.suitableFor.map(tag => `<span class="item-tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="item-price">
                    ${formatPrice(item.price)}<span class="currency"> GP</span>
                </div>
            </div>
        `;
    }).join('');
}

// ===================================
// EVENT LISTENERS
// ===================================

function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            renderItems();
        });
    });
    
    // Rarity filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRarity = btn.dataset.rarity;
            renderItems();
        });
    });
    
    // Item clicks (delegated)
    const itemList = document.getElementById('itemList');
    if (itemList) {
        itemList.addEventListener('click', (e) => {
            // Check if star was clicked
            const star = e.target.closest('.item-star');
            if (star) {
                e.stopPropagation();
                toggleFavorite(star.dataset.itemId);
                return;
            }
            
            // Check if item row was clicked
            const row = e.target.closest('.item-row');
            if (row) {
                openItemModal(row.dataset.itemId);
            }
        });
    }
    
    // Modal close
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// ===================================
// FAVORITES
// ===================================

function toggleFavorite(itemId) {
    const index = favorites.indexOf(itemId);
    if (index === -1) {
        favorites.push(itemId);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('tsi-favorites', JSON.stringify(favorites));
    renderItems();
}

// ===================================
// MODAL
// ===================================

function openItemModal(itemId) {
    const item = weeklyItems.find(i => i.id === itemId);
    if (!item) return;
    
    const rarity = item.rarity.toLowerCase();
    const iconUrl = getItemIcon(item);
    
    // Populate modal
    document.getElementById('modalIcon').src = iconUrl;
    document.getElementById('modalName').textContent = item.name;
    document.getElementById('modalType').textContent = item.type;
    
    const rarityEl = document.getElementById('modalRarity');
    rarityEl.textContent = item.rarity;
    rarityEl.className = `modal-rarity ${rarity}`;
    
    document.getElementById('modalDescription').textContent = item.description || 'A fine item from the Scarlett Isles.';
    document.getElementById('modalPrice').textContent = `${formatPriceFull(item.price)} GP`;
    
    // Stats
    const statsSection = document.getElementById('modalStatsSection');
    const statsContainer = document.getElementById('modalStats');
    
    if (item.stats && Object.keys(item.stats).length > 0) {
        statsSection.style.display = 'block';
        statsContainer.innerHTML = Object.entries(item.stats).map(([key, value]) => `
            <div class="stat-item">
                <span class="stat-label">${key}</span>
                <span class="stat-value">${value}</span>
            </div>
        `).join('');
    } else {
        statsSection.style.display = 'none';
    }
    
    // Suitable for
    document.getElementById('modalSuitable').innerHTML = item.suitableFor.map(tag => 
        `<span class="item-tag">${tag}</span>`
    ).join('');
    
    // Show modal
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ===================================
// START
// ===================================

document.addEventListener('DOMContentLoaded', init);
