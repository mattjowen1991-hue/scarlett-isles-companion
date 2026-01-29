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
    // Campaign starts week of February 3, 2026
    const campaignStart = new Date('2026-02-03');
    const now = new Date();
    const diff = now - campaignStart;
    const oneWeek = 604800000; // milliseconds in a week
    
    // If before campaign start, return 0 or 1
    if (diff < 0) return 1;
    
    return Math.floor(diff / oneWeek) + 1;
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
// ICON - Use URL from item data
// ===================================

function getItemIcon(item) {
    return item.icon || 'https://api.iconify.design/game-icons/swap-bag.svg?color=%23ffffff';
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
                    <img src="${iconUrl}" alt="${item.name}">
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

let currentModalItem = null;

function openItemModal(itemId) {
    const item = weeklyItems.find(i => i.id === itemId);
    if (!item) return;
    
    currentModalItem = item;
    const rarity = item.rarity.toLowerCase();
    const iconUrl = getItemIcon(item);
    const isRareOrBetter = ['rare', 'legendary'].includes(rarity);
    
    // Populate modal header
    document.getElementById('modalIcon').innerHTML = `<img src="${iconUrl}" alt="${item.name}">`;
    document.getElementById('modalName').textContent = item.name;
    document.getElementById('modalType').textContent = item.type;
    
    const rarityEl = document.getElementById('modalRarity');
    rarityEl.textContent = item.rarity;
    rarityEl.className = `modal-rarity ${rarity}`;
    
    // Build modal body content
    let bodyHTML = '';
    
    // Flavour text for rare/legendary
    if (isRareOrBetter && item.flavour) {
        bodyHTML += `
            <div class="modal-section">
                <p class="modal-flavour">${item.flavour}</p>
            </div>
        `;
    }
    
    // Properties section for rare/legendary
    if (item.properties || item.attunement || item.damage) {
        bodyHTML += `
            <div class="modal-section">
                <h3 class="modal-section-title">Item Details</h3>
                <div class="modal-details-grid">
                    ${item.properties ? `<div class="detail-row"><span class="detail-label">Properties</span><span class="detail-value">${item.properties}</span></div>` : ''}
                    ${item.attunement ? `<div class="detail-row"><span class="detail-label">Attunement</span><span class="detail-value">${item.attunement}</span></div>` : ''}
                    ${item.damage ? `<div class="detail-row"><span class="detail-label">Damage</span><span class="detail-value">${item.damage}</span></div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Description
    bodyHTML += `
        <div class="modal-section">
            <h3 class="modal-section-title">Description</h3>
            <div class="modal-description">${formatDescription(item.description || 'A fine item from the Scarlett Isles.')}</div>
        </div>
    `;
    
    // Stats
    if (item.stats && Object.keys(item.stats).length > 0) {
        bodyHTML += `
            <div class="modal-section">
                <h3 class="modal-section-title">Properties</h3>
                <div class="modal-stats">
                    ${Object.entries(item.stats).map(([key, value]) => `
                        <div class="stat-item">
                            <span class="stat-label">${key}</span>
                            <span class="stat-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Suitable for
    bodyHTML += `
        <div class="modal-section">
            <h3 class="modal-section-title">Suitable For</h3>
            <div class="modal-suitable">
                ${item.suitableFor.map(tag => `<span class="item-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `;
    
    // Price
    bodyHTML += `
        <div class="modal-section">
            <div class="modal-price">
                <span class="modal-price-label">Price</span>
                <span class="modal-price-value">${formatPriceFull(item.price)} GP</span>
            </div>
        </div>
    `;
    
    // Copy button
    bodyHTML += `
        <div class="modal-section">
            <button class="copy-btn" onclick="copyItemToClipboard()">
                <span class="copy-btn-icon">📋</span>
                Copy for D&D Beyond
            </button>
        </div>
    `;
    
    document.getElementById('modalBody').innerHTML = bodyHTML;
    
    // Show modal
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function formatDescription(desc) {
    // Convert markdown-style bold to HTML
    return desc
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

function copyItemToClipboard() {
    if (!currentModalItem) return;
    
    const item = currentModalItem;
    const rarity = item.rarity;
    
    let text = `**${item.name}**\n`;
    text += `${item.type}, ${rarity.toLowerCase()}\n`;
    text += `Cost: ${formatPriceFull(item.price)} gp\n`;
    
    if (item.properties) {
        text += `Properties: ${item.properties}\n`;
    }
    if (item.attunement) {
        text += `Requires Attunement: ${item.attunement}\n`;
    }
    if (item.damage) {
        text += `Damage: ${item.damage}\n`;
    }
    
    text += `\n`;
    
    if (item.flavour) {
        text += `*${item.flavour}*\n\n`;
    }
    
    text += item.description || '';
    
    navigator.clipboard.writeText(text).then(() => {
        // Show feedback
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="copy-btn-icon">✓</span> Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    currentModalItem = null;
}

// ===================================
// START
// ===================================

document.addEventListener('DOMContentLoaded', init);
