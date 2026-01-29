/* ===================================
   THE SCARLETT ISLES - KNIGHTLY TREASURES
   Shop Application Logic
   =================================== */

// ===================================
// FIREBASE CONFIGURATION
// ===================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCAtLDqghTbYhyhwcoTsefTiMecC30RMuQ",
    authDomain: "scarlett-isles-companion.firebaseapp.com",
    projectId: "scarlett-isles-companion",
    storageBucket: "scarlett-isles-companion.firebasestorage.app",
    messagingSenderId: "269614761446",
    appId: "1:269614761446:web:d420e1198e62b68a474227",
    databaseURL: "https://scarlett-isles-companion-default-rtdb.firebaseio.com"
};

let app, db;
let firebaseEnabled = false;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    firebaseEnabled = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization failed, running in offline mode:', error);
    firebaseEnabled = false;
}

// ===================================
// CONFIGURATION
// ===================================

const CONFIG = {
    campaignStart: new Date('2026-02-03'),
    // Shop rotation rules
    commonCount: 10,
    uncommonCount: 8,
    rareCount: 5,        // At least 1 per class
    legendaryPerClass: 1, // 1 per class (Fighter, Rogue, Ranger, Paladin)
    classes: ['Fighter', 'Rogue', 'Ranger', 'Paladin']
};

function getWeekNumber() {
    const now = new Date();
    const diff = now - CONFIG.campaignStart;
    const oneWeek = 604800000;
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
// ICON HELPER
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
let purchasedItems = {}; // { itemId: { purchasedBy: 'PlayerName', purchasedAt: timestamp, week: number } }
let currentCategory = 'all';
let currentRarity = 'all';
let favorites = JSON.parse(localStorage.getItem('tsi-favorites') || '[]');
let currentWeek = getWeekNumber();

// ===================================
// FIREBASE SYNC
// ===================================

function setupFirebaseListeners() {
    if (!firebaseEnabled) {
        console.log('Firebase disabled, skipping listeners');
        return;
    }
    
    const purchasedRef = ref(db, 'purchased');
    
    onValue(purchasedRef, (snapshot) => {
        purchasedItems = snapshot.val() || {};
        console.log('Purchased items updated:', purchasedItems);
        // Re-generate weekly items with updated purchased list
        if (allItems.length > 0) {
            weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
            renderItems();
        }
    }, (error) => {
        console.warn('Firebase listener error:', error);
    });
}

async function markAsPurchased(itemId, playerName) {
    if (!firebaseEnabled) {
        alert('Purchase tracking is offline. Please check Firebase connection.');
        return;
    }
    
    const item = weeklyItems.find(i => i.id === itemId);
    if (!item) return;
    
    const purchaseData = {
        purchasedBy: playerName,
        purchasedAt: Date.now(),
        week: currentWeek,
        itemName: item.name,
        rarity: item.rarity
    };
    
    try {
        await set(ref(db, `purchased/${itemId}`), purchaseData);
        console.log('Item marked as purchased:', itemId);
    } catch (error) {
        console.error('Failed to mark item as purchased:', error);
        alert('Failed to record purchase. Please try again.');
    }
}

// ===================================
// WEEKLY INVENTORY GENERATION
// ===================================

function generateWeeklyInventory(items, week, purchased) {
    const seed = week * 1000;
    
    // Filter out purchased rare/legendary items
    const availableItems = items.filter(item => {
        const rarity = item.rarity.toLowerCase();
        if (rarity === 'rare' || rarity === 'legendary') {
            return !purchased[item.id];
        }
        return true;
    });
    
    // Separate by rarity
    const common = availableItems.filter(i => i.rarity.toLowerCase() === 'common');
    const uncommon = availableItems.filter(i => i.rarity.toLowerCase() === 'uncommon');
    const rare = availableItems.filter(i => i.rarity.toLowerCase() === 'rare');
    const legendary = availableItems.filter(i => i.rarity.toLowerCase() === 'legendary');
    
    const selected = [];
    
    // 1. Select LEGENDARY items (1 per class)
    CONFIG.classes.forEach((cls, idx) => {
        const classLegendary = legendary.filter(i => i.suitableFor.includes(cls));
        if (classLegendary.length > 0) {
            const shuffled = shuffleWithSeed(classLegendary, seed + idx + 1000);
            // Only add if not already selected
            const toAdd = shuffled.find(i => !selected.includes(i));
            if (toAdd) selected.push(toAdd);
        }
    });
    
    // 2. Select RARE items (5 total, at least 1 per class)
    const selectedRare = [];
    CONFIG.classes.forEach((cls, idx) => {
        const classRare = rare.filter(i => i.suitableFor.includes(cls) && !selectedRare.includes(i));
        if (classRare.length > 0) {
            const shuffled = shuffleWithSeed(classRare, seed + idx + 2000);
            selectedRare.push(shuffled[0]);
        }
    });
    
    // Fill remaining rare slots
    const remainingRare = rare.filter(i => !selectedRare.includes(i));
    const shuffledRemainingRare = shuffleWithSeed(remainingRare, seed + 2500);
    const rareNeeded = CONFIG.rareCount - selectedRare.length;
    selectedRare.push(...shuffledRemainingRare.slice(0, rareNeeded));
    selected.push(...selectedRare);
    
    // 3. Select UNCOMMON items (8 total)
    const shuffledUncommon = shuffleWithSeed(uncommon, seed + 3000);
    selected.push(...shuffledUncommon.slice(0, CONFIG.uncommonCount));
    
    // 4. Select COMMON items (10 total)
    const shuffledCommon = shuffleWithSeed(common, seed + 4000);
    selected.push(...shuffledCommon.slice(0, CONFIG.commonCount));
    
    return selected;
}

// ===================================
// INITIALIZATION
// ===================================

async function init() {
    // Set week number
    const weekEl = document.getElementById('weekNumber');
    if (weekEl) {
        weekEl.textContent = currentWeek;
    }
    
    // Load items first
    try {
        const response = await fetch('items.json');
        allItems = await response.json();
        console.log('Loaded', allItems.length, 'items');
        
        // Try to get purchased items from Firebase
        if (firebaseEnabled) {
            try {
                const purchasedSnapshot = await get(ref(db, 'purchased'));
                purchasedItems = purchasedSnapshot.val() || {};
                console.log('Loaded purchased items from Firebase');
                // Setup real-time listeners
                setupFirebaseListeners();
            } catch (fbError) {
                console.warn('Firebase read failed, using empty purchased list:', fbError);
                purchasedItems = {};
            }
        }
        
        // Generate this week's selection
        weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
        console.log('Generated', weeklyItems.length, 'items for week', currentWeek);
        
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
                    <p class="empty-state-text" style="font-size: 0.8rem; margin-top: 0.5rem;">${error.message}</p>
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
    
    // Help modal
    const helpBtn = document.getElementById('helpBtn');
    const helpOverlay = document.getElementById('helpOverlay');
    const helpClose = document.getElementById('helpClose');
    
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    if (helpOverlay) {
        helpOverlay.addEventListener('click', (e) => {
            if (e.target === helpOverlay) {
                helpOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    
    if (helpClose) {
        helpClose.addEventListener('click', () => {
            helpOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            if (helpOverlay) {
                helpOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
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
    
    // Action buttons
    bodyHTML += `
        <div class="modal-section modal-actions">
            <button class="copy-btn" onclick="copyItemToClipboard()">
                <span class="copy-btn-icon">📋</span>
                Copy for D&D Beyond
            </button>
    `;
    
    // Purchase button for rare/legendary only
    if (isRareOrBetter) {
        bodyHTML += `
            <button class="purchase-btn" onclick="showPurchaseDialog()">
                <span class="purchase-btn-icon">💰</span>
                Mark as Purchased
            </button>
        `;
    }
    
    bodyHTML += `</div>`;
    
    document.getElementById('modalBody').innerHTML = bodyHTML;
    
    // Show modal
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function formatDescription(desc) {
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

function showPurchaseDialog() {
    if (!currentModalItem) return;
    
    const playerName = prompt(`Who is purchasing the ${currentModalItem.name}?\n\nEnter player/character name:`);
    
    if (playerName && playerName.trim()) {
        const firstConfirm = confirm(`⚠️ FIRST CONFIRMATION ⚠️\n\n${currentModalItem.name}\nPurchased by: ${playerName.trim()}\nPrice: ${formatPriceFull(currentModalItem.price)} GP\n\nHave you ACTUALLY purchased this item and added it to your D&D Beyond inventory?`);
        
        if (firstConfirm) {
            const finalConfirm = confirm(`⚠️ FINAL CONFIRMATION ⚠️\n\nThis action CANNOT be undone!\n\nThe ${currentModalItem.name} will be permanently removed from the shop.\n\nAre you absolutely sure?`);
            
            if (finalConfirm) {
                markAsPurchased(currentModalItem.id, playerName.trim());
                closeModal();
            }
        }
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    currentModalItem = null;
}

// Make functions available globally for onclick handlers
window.copyItemToClipboard = copyItemToClipboard;
window.showPurchaseDialog = showPurchaseDialog;

// ===================================
// START
// ===================================

document.addEventListener('DOMContentLoaded', init);
