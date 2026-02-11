/* ===================================
   THE SCARLETT ISLES - KNIGHTLY TREASURES
   Shop Application Logic
   =================================== */

// ===================================
// FIREBASE CONFIGURATION
// ===================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    // Shop rotation rules - balanced for weapons/armor/gear
    commonCount: 6,      // 4 weapons/armor + 2 gear
    uncommonCount: 10,   // 5 weapons + 4 armor + 1 gear
    rareCount: 8,        // 4 weapons + 3 armor + 1 gear
    legendaryPerClass: 1, // 1 weapon OR armor per class
    classes: ['Fighter', 'Rogue', 'Ranger'],  // Your party composition
    // Reservation settings
    reservationDuration: 14 * 24 * 60 * 60 * 1000 // 2 weeks in milliseconds
};

// Honour system integration - matches tsi-honour-tracker
const HONOUR_CONFIG = {
    locations: [
        { id: 'neutral', name: 'Neutral Territory', clanId: null },
        { id: 'blackstone', name: 'Clan Blackstone', clanId: 'blackstone' },
        { id: 'bacca', name: 'Clan Bacca', clanId: 'bacca' },
        { id: 'farmer', name: 'Clan Farmer', clanId: 'farmer' },
        { id: 'slade', name: 'Clan Slade', clanId: 'slade' },
        { id: 'molten', name: 'Clan Molten', clanId: 'molten' },
        { id: 'karr', name: 'Clan Karr', clanId: 'karr' },
        { id: 'rowthorn', name: 'Clan Rowthorn', clanId: 'rowthorn' },
    ],
    // Price modifiers by exact honour score (linear scale)
    priceModifiers: {
        '-5': { modifier: null, label: 'No Trade', status: 'HUNTED' },
        '-4': { modifier: 0.50, label: '+50%', status: 'HOSTILE' },
        '-3': { modifier: 0.40, label: '+40%', status: 'HOSTILE' },
        '-2': { modifier: 0.30, label: '+30%', status: 'DISTRUSTED' },
        '-1': { modifier: 0.20, label: '+20%', status: 'DISTRUSTED' },
        '0':  { modifier: 0, label: 'Standard', status: 'NEUTRAL' },
        '1':  { modifier: -0.05, label: '-5%', status: 'TRUSTED' },
        '2':  { modifier: -0.10, label: '-10%', status: 'TRUSTED' },
        '3':  { modifier: -0.15, label: '-15%', status: 'ALLIED' },
        '4':  { modifier: -0.20, label: '-20%', status: 'ALLIED' },
        '5':  { modifier: -0.25, label: '-25%', status: 'SANCTUARY' },
    }
};

// Honour data from Firebase (synced in real-time)
let honourData = { clanScores: {} };

// Active quests from Quest Generator (synced in real-time)
let activeQuests = [];

// Current location - now controlled by DM via Firebase
let currentLocation = 'neutral';

function getWeekNumber() {
    const now = new Date();
    const diff = now - CONFIG.campaignStart;
    const oneWeek = 604800000;
    if (diff < 0) return 1;
    return Math.floor(diff / oneWeek) + 1;
}

// Get honour band from score (matches honour tracker logic)
function getHonourBand(score) {
    if (score <= -4) return -5;
    if (score <= -2) return -3;
    if (score === -1) return -1;
    if (score === 0) return 0;
    if (score <= 2) return 1;
    if (score <= 4) return 3;
    return 5;
}

// Get price modifier info for current location
function getPriceModifier() {
    const location = HONOUR_CONFIG.locations.find(l => l.id === currentLocation);
    if (!location || !location.clanId) {
        return { modifier: 0, label: 'Standard', status: 'NEUTRAL', score: 0 };
    }
    
    // Use honour data from Firebase
    const clanScores = honourData.clanScores || {};
    const score = clanScores[location.clanId] ?? 0;
    
    // Use exact score for lookup (no banding)
    const modInfo = HONOUR_CONFIG.priceModifiers[String(score)] || HONOUR_CONFIG.priceModifiers['0'];
    return { ...modInfo, score };
}

// Calculate adjusted price
function getAdjustedPrice(basePrice) {
    const modInfo = getPriceModifier();
    if (modInfo.modifier === null) {
        return { price: basePrice, noTrade: true, modInfo };
    }
    const adjusted = Math.round(basePrice * (1 + modInfo.modifier));
    return { price: adjusted, noTrade: false, modInfo };
}

// ===================================
// ACTIVE QUEST HELPERS
// ===================================

// Get all tags from active quests
function getActiveQuestTags() {
    const tags = new Set();
    activeQuests.forEach(quest => {
        if (quest.tags) {
            quest.tags.forEach(tag => tags.add(tag));
        }
        // Also add quest_type as a tag for matching
        if (quest.quest_type) {
            tags.add(quest.quest_type);
        }
    });
    return tags;
}

// Check if an item is relevant to active quests
function isQuestRelevant(item) {
    if (!activeQuests.length || !item.questTags || !item.questTags.length) {
        return false;
    }
    
    const activeTags = getActiveQuestTags();
    return item.questTags.some(tag => activeTags.has(tag));
}

// Update the active quest display in the UI
function updateActiveQuestDisplay() {
    const container = document.getElementById('activeQuestDisplay');
    if (!container) return;
    
    if (!activeQuests.length) {
        container.innerHTML = '<span class="no-quest">No active quest</span>';
        container.classList.remove('has-quest');
        return;
    }
    
    // Show the first/primary quest
    const quest = activeQuests[0];
    container.innerHTML = `
        <span class="quest-icon">📜</span>
        <span class="quest-title">${quest.title}</span>
        <span class="quest-type">${quest.quest_type}</span>
    `;
    container.classList.add('has-quest');
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
// RESERVATION TIMER HELPERS
// ===================================

function getReservationTimeRemaining(reservedAt) {
    const expiresAt = reservedAt + CONFIG.reservationDuration;
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
        return { expired: true, text: 'Expired', days: 0, hours: 0 };
    }
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    let text;
    if (days > 0) {
        text = `${days}d ${hours}h`;
    } else if (hours > 0) {
        text = `${hours}h ${minutes}m`;
    } else {
        text = `${minutes}m`;
    }
    
    return { expired: false, text, days, hours, minutes, remaining };
}

function isReservationExpired(reservation) {
    if (!reservation || !reservation.reservedAt) return true;
    const timeInfo = getReservationTimeRemaining(reservation.reservedAt);
    return timeInfo.expired;
}

async function checkAndExpireReservations() {
    if (!firebaseEnabled) return;
    
    for (const [itemId, reservation] of Object.entries(reservedItems)) {
        if (isReservationExpired(reservation)) {
            console.log(`Reservation expired for ${reservation.itemName || itemId}, removing...`);
            try {
                await remove(ref(db, `reserved/${itemId}`));
                console.log(`Expired reservation removed: ${itemId}`);
            } catch (error) {
                console.error(`Failed to remove expired reservation: ${itemId}`, error);
            }
        }
    }
}

// ===================================
// STATE
// ===================================

let allItems = [];
let weeklyItems = [];
let purchasedItems = {}; // { itemId: { purchasedBy: 'PlayerName', purchasedAt: timestamp, week: number } }
let reservedItems = {}; // { itemId: { reservedBy: 'PlayerName', reservedAt: timestamp, depositPaid: number } }
let currentCategory = 'all';
let currentRarity = 'all';
let favorites = JSON.parse(localStorage.getItem('tsi-favorites') || '[]');
let currentWeek = getWeekNumber();
// ===================================
// FAVORITES CLEANUP
// ===================================

function cleanupOrphanedFavorites(purchased) {
    // Remove any favourites that have been purchased
    const purchasedIds = Object.keys(purchased);
    const originalLength = favorites.length;
    
    favorites = favorites.filter(favId => !purchasedIds.includes(favId));
    
    if (favorites.length !== originalLength) {
        localStorage.setItem('tsi-favorites', JSON.stringify(favorites));
        console.log(`Cleaned up ${originalLength - favorites.length} orphaned favourite(s)`);
    }
}

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
        
        // Clean up any favourites for items that have been purchased
        cleanupOrphanedFavorites(purchasedItems);
        
        // Re-generate weekly items with updated purchased list
        if (allItems.length > 0) {
            weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
            renderItems();
        }
    }, (error) => {
        console.warn('Firebase listener error:', error);
    });
    
    // Listen for reservation changes
    const reservedRef = ref(db, 'reserved');
    
    onValue(reservedRef, (snapshot) => {
        reservedItems = snapshot.val() || {};
        console.log('Reserved items updated:', reservedItems);
        
        // Re-render to show reservation notes
        if (allItems.length > 0) {
            renderItems();
        }
    }, (error) => {
        console.warn('Firebase reservation listener error:', error);
    });
    
    // Listen for honour data changes (from the Honour Tracker app)
    const honourRef = ref(db, 'honour');
    
    onValue(honourRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            honourData = data;
            console.log('Honour data updated:', honourData.clanScores);
            
            // Re-render to update prices
            if (allItems.length > 0) {
                updateLocationStatus();
                renderItems();
            }
        }
    }, (error) => {
        console.warn('Firebase honour listener error:', error);
    });
    
    // Listen for party location changes (controlled by DM)
    const locationRef = ref(db, 'partyLocation');
    
    onValue(locationRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.locationId) {
            currentLocation = data.locationId;
            console.log('Party location updated:', currentLocation);
            
            // Update the display (but not the selector - that's DM only now)
            if (allItems.length > 0) {
                updateLocationStatus();
                renderItems();
            }
        }
    }, (error) => {
        console.warn('Firebase location listener error:', error);
    });
    
    // Listen for active quests (from Quest Generator)
    const activeQuestsRef = ref(db, 'activeQuests');
    
    onValue(activeQuestsRef, (snapshot) => {
        const data = snapshot.val();
        const previousQuest = activeQuests.length > 0 ? activeQuests[0] : null;
        
        if (data && data.primaryQuest) {
            activeQuests = [data.primaryQuest];
            console.log('Primary quest updated:', data.primaryQuest.title);
            updateActiveQuestDisplay();
            
            // Regenerate inventory with quest-aware selection
            if (allItems.length > 0) {
                weeklyItems = generateQuestInventory(allItems, currentWeek, purchasedItems, data.primaryQuest, currentLocation);
                renderItems();
            }
        } else {
            // No active quest - revert to normal weekly rotation
            if (activeQuests.length > 0) {
                console.log('Quest cleared, reverting to normal inventory');
                activeQuests = [];
                updateActiveQuestDisplay();
                
                if (allItems.length > 0) {
                    weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
                    renderItems();
                }
            }
        }
    }, (error) => {
        console.warn('Firebase active quests listener error:', error);
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
        
        // If item was reserved, remove the reservation
        if (reservedItems[itemId]) {
            await remove(ref(db, `reserved/${itemId}`));
            console.log('Reservation cleared for purchased item:', itemId);
        }
    } catch (error) {
        console.error('Failed to mark item as purchased:', error);
        alert('Failed to record purchase. Please try again.');
    }
}

// ===================================
// RESERVATIONS
// ===================================

async function reserveItem(itemId, playerName) {
    if (!firebaseEnabled) {
        alert('Reservations are offline. Please check Firebase connection.');
        return;
    }
    
    const item = weeklyItems.find(i => i.id === itemId);
    if (!item) return;
    
    const deposit = Math.floor(item.price * 0.1);
    
    const reservationData = {
        reservedBy: playerName,
        reservedAt: Date.now(),
        week: currentWeek,
        itemName: item.name,
        rarity: item.rarity,
        depositPaid: deposit,
        fullPrice: item.price
    };
    
    try {
        await set(ref(db, `reserved/${itemId}`), reservationData);
        console.log('Item reserved:', itemId);
    } catch (error) {
        console.error('Failed to reserve item:', error);
        alert('Failed to reserve item. Please try again.');
    }
}

async function cancelReservation(itemId) {
    if (!firebaseEnabled) {
        alert('Cannot cancel reservation. Please check Firebase connection.');
        return;
    }
    
    try {
        await remove(ref(db, `reserved/${itemId}`));
        console.log('Reservation cancelled:', itemId);
        return true;
    } catch (error) {
        console.error('Failed to cancel reservation:', error);
        alert('Failed to cancel reservation. Please try again.');
        return false;
    }
}

// ===================================
// WEEKLY INVENTORY GENERATION
// ===================================

// Normal mode: Weapons & Armor focused (no quest active)
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
    
    // Separate by category first, then rarity
    const weapons = availableItems.filter(i => i.category === 'weapons');
    const armor = availableItems.filter(i => i.category === 'armor');
    const gear = availableItems.filter(i => i.category === 'gear');
    
    const selected = [];
    
    // 1. LEGENDARY - 1 weapon OR armor per class (prioritize weapons)
    CONFIG.classes.forEach((cls, idx) => {
        const classWeapons = weapons.filter(i => i.rarity === 'Legendary' && i.suitableFor.includes(cls));
        const classArmor = armor.filter(i => i.rarity === 'Legendary' && i.suitableFor.includes(cls));
        const combined = [...classWeapons, ...classArmor];
        
        if (combined.length > 0) {
            const shuffled = shuffleWithSeed(combined, seed + idx + 1000);
            const toAdd = shuffled.find(i => !selected.includes(i));
            if (toAdd) selected.push(toAdd);
        }
    });
    
    // 2. RARE - Prioritize weapons and armor (6 weapons/armor, 2 gear)
    const rareWeapons = weapons.filter(i => i.rarity === 'Rare');
    const rareArmor = armor.filter(i => i.rarity === 'Rare');
    const rareGear = gear.filter(i => i.rarity === 'Rare');
    
    // Ensure 1 rare weapon per class
    const selectedRare = [];
    CONFIG.classes.forEach((cls, idx) => {
        const classRareWeapons = rareWeapons.filter(i => i.suitableFor.includes(cls) && !selectedRare.includes(i));
        if (classRareWeapons.length > 0) {
            const shuffled = shuffleWithSeed(classRareWeapons, seed + idx + 2000);
            selectedRare.push(shuffled[0]);
        }
    });
    
    // Add rare armor (2-3 pieces)
    const shuffledRareArmor = shuffleWithSeed(rareArmor, seed + 2100);
    selectedRare.push(...shuffledRareArmor.slice(0, 3));
    
    // Add 1-2 rare gear (essentials like potions, boots of speed)
    const shuffledRareGear = shuffleWithSeed(rareGear, seed + 2200);
    selectedRare.push(...shuffledRareGear.slice(0, 2));
    
    selected.push(...selectedRare.slice(0, CONFIG.rareCount));
    
    // 3. UNCOMMON - Heavy on weapons/armor (6 weapons/armor, 4 gear)
    const uncommonWeapons = weapons.filter(i => i.rarity === 'Uncommon');
    const uncommonArmor = armor.filter(i => i.rarity === 'Uncommon');
    const uncommonGear = gear.filter(i => i.rarity === 'Uncommon');
    
    const shuffledUncommonWeapons = shuffleWithSeed(uncommonWeapons, seed + 3000);
    const shuffledUncommonArmor = shuffleWithSeed(uncommonArmor, seed + 3100);
    const shuffledUncommonGear = shuffleWithSeed(uncommonGear, seed + 3200);
    
    const selectedUncommon = [
        ...shuffledUncommonWeapons.slice(0, 4),
        ...shuffledUncommonArmor.slice(0, 3),
        ...shuffledUncommonGear.slice(0, 3)
    ];
    selected.push(...selectedUncommon.slice(0, CONFIG.uncommonCount));
    
    // 4. COMMON - Balanced (weapons/armor + essentials)
    const commonWeapons = weapons.filter(i => i.rarity === 'Common');
    const commonArmor = armor.filter(i => i.rarity === 'Common');
    const commonGear = gear.filter(i => i.rarity === 'Common');
    
    const shuffledCommonWeapons = shuffleWithSeed(commonWeapons, seed + 4000);
    const shuffledCommonArmor = shuffleWithSeed(commonArmor, seed + 4100);
    const shuffledCommonGear = shuffleWithSeed(commonGear, seed + 4200);
    
    const selectedCommon = [
        ...shuffledCommonWeapons.slice(0, 2),
        ...shuffledCommonArmor.slice(0, 2),
        ...shuffledCommonGear.slice(0, 2)
    ];
    selected.push(...selectedCommon.slice(0, CONFIG.commonCount));
    
    console.log('Generated NORMAL inventory (weapons/armor focus):', {
        totalItems: selected.length,
        weapons: selected.filter(i => i.category === 'weapons').length,
        armor: selected.filter(i => i.category === 'armor').length,
        gear: selected.filter(i => i.category === 'gear').length
    });
    
    return selected;
}

// Generate quest-aware inventory when there's an active quest (quest mode)
function generateQuestInventory(items, week, purchased, primaryQuest, locationId) {
    const seed = week * 1000;
    
    // Filter out purchased rare/legendary items
    const availableItems = items.filter(item => {
        const rarity = item.rarity.toLowerCase();
        if (rarity === 'rare' || rarity === 'legendary') {
            return !purchased[item.id];
        }
        return true;
    });
    
    // Get quest tags and province info
    const questTags = new Set(primaryQuest.tags || []);
    questTags.add(primaryQuest.quest_type); // Include quest type
    
    // Map location to province theme
    const locationProvinceMap = {
        'neutral': 'General',
        'blackstone': 'Northern',
        'bacca': 'Midland', 
        'farmer': 'Western',
        'slade': 'General', // Eastern - general for now
        'molten': 'Southern',
        'karr': 'Coastal',
        'rowthorn': 'Coastal'
    };
    const provinceTheme = locationProvinceMap[locationId] || 'General';
    
    // Score items by relevance
    function getItemRelevance(item) {
        let score = 0;
        
        // Quest tag matching (high priority)
        const itemQuestTags = item.questTags || [];
        itemQuestTags.forEach(tag => {
            if (questTags.has(tag)) score += 10;
        });
        
        // Province matching (medium priority)
        const itemProvinceTags = item.provinceTags || ['General'];
        if (itemProvinceTags.includes(provinceTheme)) score += 5;
        if (itemProvinceTags.includes('General')) score += 1;
        
        return score;
    }
    
    // Separate by rarity and score
    const common = availableItems.filter(i => i.rarity.toLowerCase() === 'common');
    const uncommon = availableItems.filter(i => i.rarity.toLowerCase() === 'uncommon');
    const rare = availableItems.filter(i => i.rarity.toLowerCase() === 'rare');
    const legendary = availableItems.filter(i => i.rarity.toLowerCase() === 'legendary');
    
    const selected = [];
    
    // 1. LEGENDARY - same as before (1 per class)
    CONFIG.classes.forEach((cls, idx) => {
        const classLegendary = legendary.filter(i => i.suitableFor.includes(cls));
        if (classLegendary.length > 0) {
            // Prefer quest-relevant legendaries
            const sorted = classLegendary.sort((a, b) => getItemRelevance(b) - getItemRelevance(a));
            const shuffled = shuffleWithSeed(sorted.slice(0, 3), seed + idx + 1000); // Pick from top 3
            const toAdd = shuffled.find(i => !selected.includes(i)) || sorted[0];
            if (toAdd && !selected.includes(toAdd)) selected.push(toAdd);
        }
    });
    
    // 2. RARE items - prioritize quest-relevant (at least 50% should be relevant)
    const selectedRare = [];
    const relevantRare = rare.filter(i => getItemRelevance(i) >= 5);
    const nonRelevantRare = rare.filter(i => getItemRelevance(i) < 5);
    
    // Ensure 1 rare per class first
    CONFIG.classes.forEach((cls, idx) => {
        const classRare = rare.filter(i => i.suitableFor.includes(cls) && !selectedRare.includes(i));
        if (classRare.length > 0) {
            // Prefer relevant ones
            const sorted = classRare.sort((a, b) => getItemRelevance(b) - getItemRelevance(a));
            selectedRare.push(sorted[0]);
        }
    });
    
    // Fill remaining rare slots with quest-relevant items
    const remainingRelevantRare = relevantRare.filter(i => !selectedRare.includes(i));
    const shuffledRelevantRare = shuffleWithSeed(remainingRelevantRare, seed + 2500);
    const rareNeeded = CONFIG.rareCount - selectedRare.length;
    selectedRare.push(...shuffledRelevantRare.slice(0, rareNeeded));
    
    // If still need more, add non-relevant
    if (selectedRare.length < CONFIG.rareCount) {
        const stillNeeded = CONFIG.rareCount - selectedRare.length;
        const remainingNonRelevant = nonRelevantRare.filter(i => !selectedRare.includes(i));
        const shuffled = shuffleWithSeed(remainingNonRelevant, seed + 2600);
        selectedRare.push(...shuffled.slice(0, stillNeeded));
    }
    selected.push(...selectedRare);
    
    // 3. UNCOMMON - at least 50% quest-relevant
    const relevantUncommon = uncommon.filter(i => getItemRelevance(i) >= 5);
    const nonRelevantUncommon = uncommon.filter(i => getItemRelevance(i) < 5);
    
    const relevantUncommonCount = Math.ceil(CONFIG.uncommonCount * 0.5);
    const shuffledRelevantUncommon = shuffleWithSeed(relevantUncommon, seed + 3000);
    const shuffledNonRelevantUncommon = shuffleWithSeed(nonRelevantUncommon, seed + 3100);
    
    const selectedUncommon = [
        ...shuffledRelevantUncommon.slice(0, relevantUncommonCount),
        ...shuffledNonRelevantUncommon.slice(0, CONFIG.uncommonCount - relevantUncommonCount)
    ];
    selected.push(...selectedUncommon.slice(0, CONFIG.uncommonCount));
    
    // 4. COMMON - at least 50% quest-relevant
    const relevantCommon = common.filter(i => getItemRelevance(i) >= 5);
    const nonRelevantCommon = common.filter(i => getItemRelevance(i) < 5);
    
    const relevantCommonCount = Math.ceil(CONFIG.commonCount * 0.5);
    const shuffledRelevantCommon = shuffleWithSeed(relevantCommon, seed + 4000);
    const shuffledNonRelevantCommon = shuffleWithSeed(nonRelevantCommon, seed + 4100);
    
    const selectedCommon = [
        ...shuffledRelevantCommon.slice(0, relevantCommonCount),
        ...shuffledNonRelevantCommon.slice(0, CONFIG.commonCount - relevantCommonCount)
    ];
    selected.push(...selectedCommon.slice(0, CONFIG.commonCount));
    
    console.log('Generated QUEST inventory (quest-gear focus):', {
        quest: primaryQuest.title,
        tags: Array.from(questTags),
        province: provinceTheme,
        totalItems: selected.length,
        questRelevant: selected.filter(i => getItemRelevance(i) >= 5).length,
        weapons: selected.filter(i => i.category === 'weapons').length,
        armor: selected.filter(i => i.category === 'armor').length,
        gear: selected.filter(i => i.category === 'gear').length
    });
    
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
        
        // Try to get purchased and reserved items from Firebase
        if (firebaseEnabled) {
            try {
                const purchasedSnapshot = await get(ref(db, 'purchased'));
                purchasedItems = purchasedSnapshot.val() || {};
                console.log('Loaded purchased items from Firebase');
                
                const reservedSnapshot = await get(ref(db, 'reserved'));
                reservedItems = reservedSnapshot.val() || {};
                console.log('Loaded reserved items from Firebase');
                
                // Load honour data for price adjustments
                const honourSnapshot = await get(ref(db, 'honour'));
                if (honourSnapshot.exists()) {
                    honourData = honourSnapshot.val();
                    console.log('Loaded honour data from Firebase');
                }
                
                // Load party location (set by DM)
                const locationSnapshot = await get(ref(db, 'partyLocation'));
                if (locationSnapshot.exists()) {
                    const locData = locationSnapshot.val();
                    if (locData && locData.locationId) {
                        currentLocation = locData.locationId;
                        console.log('Loaded party location from Firebase:', currentLocation);
                    }
                }
                
                // Check and remove any expired reservations
                await checkAndExpireReservations();
                
                // Clean up any orphaned favourites
                cleanupOrphanedFavorites(purchasedItems);
                
                // Load active quest for inventory generation
                const activeQuestSnapshot = await get(ref(db, 'activeQuests'));
                let primaryQuest = null;
                if (activeQuestSnapshot.exists()) {
                    const questData = activeQuestSnapshot.val();
                    if (questData && questData.primaryQuest) {
                        primaryQuest = questData.primaryQuest;
                        activeQuests = [primaryQuest];
                        console.log('Loaded primary quest from Firebase:', primaryQuest.title);
                    }
                }
                
                // Setup real-time listeners
                setupFirebaseListeners();
                
                // Generate inventory based on whether there's an active quest
                if (primaryQuest) {
                    weeklyItems = generateQuestInventory(allItems, currentWeek, purchasedItems, primaryQuest, currentLocation);
                } else {
                    weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
                }
            } catch (fbError) {
                console.warn('Firebase read failed, using empty purchased list:', fbError);
                purchasedItems = {};
                reservedItems = {};
                weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
            }
        } else {
            // No Firebase - use normal inventory
            weeklyItems = generateWeeklyInventory(allItems, currentWeek, purchasedItems);
        }
        
        console.log('Generated', weeklyItems.length, 'items for week', currentWeek);
        
        // Update quest display
        updateActiveQuestDisplay();
        
        renderItems();
        setupEventListeners();
        
        // Update reservation timers every minute
        setInterval(() => {
            checkAndExpireReservations();
            renderItems();
        }, 60000);
        
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
        const reservation = reservedItems[item.id];
        const isLegendary = rarity === 'legendary';
        const questRelevant = isQuestRelevant(item);
        
        // Get adjusted price based on location/honour
        const priceInfo = getAdjustedPrice(item.price);
        
        // Build reservation note HTML if item is reserved
        let reservationNote = '';
        if (reservation && isLegendary) {
            const timeRemaining = getReservationTimeRemaining(reservation.reservedAt);
            const urgencyClass = timeRemaining.days <= 2 ? 'urgent' : (timeRemaining.days <= 5 ? 'warning' : '');
            
            reservationNote = `
                <div class="reservation-note">
                    <div class="reservation-scroll">
                        <span class="reservation-icon">📜</span>
                        <span class="reservation-text">Reserved by <strong>${reservation.reservedBy}</strong></span>
                        <span class="reservation-timer ${urgencyClass}">
                            <span class="timer-icon">⏳</span>
                            <span class="timer-text">${timeRemaining.text}</span>
                        </span>
                    </div>
                </div>
            `;
        }
        
        // Quest relevance badge and hint
        let questBadge = '';
        let questHint = '';
        if (questRelevant) {
            questBadge = `<span class="quest-relevant-badge" title="Useful for current quest">📜 Quest</span>`;
            if (item.questHint) {
                questHint = `<p class="quest-hint">"${item.questHint}"</p>`;
            }
        }
        
        // Build price display with modifier
        let priceHTML;
        if (priceInfo.noTrade) {
            priceHTML = `<span class="no-trade">No Trade</span>`;
        } else if (priceInfo.modInfo.modifier !== 0) {
            const modClass = priceInfo.modInfo.modifier > 0 ? 'price-increase' : 'price-discount';
            priceHTML = `
                ${formatPrice(priceInfo.price)}<span class="currency"> GP</span>
                <span class="price-modifier ${modClass}">${priceInfo.modInfo.label}</span>
            `;
        } else {
            priceHTML = `${formatPrice(item.price)}<span class="currency"> GP</span>`;
        }
        
        return `
            <div class="item-row ${rarity} ${reservation ? 'reserved' : ''} ${priceInfo.noTrade ? 'no-trade-item' : ''} ${questRelevant ? 'quest-relevant' : ''}" data-item-id="${item.id}">
                <span class="item-star ${isFavorite ? 'favorited' : ''}" data-item-id="${item.id}">
                    ${isFavorite ? '★' : '☆'}
                </span>
                <div class="item-icon">
                    <img src="${iconUrl}" alt="${item.name}">
                </div>
                <div class="item-details">
                    <h3 class="item-name">${item.name} ${questBadge}</h3>
                    <p class="item-type">${item.type}</p>
                    ${questHint}
                    <div class="item-tags">
                        ${item.suitableFor.map(tag => `<span class="item-tag">${tag}</span>`).join('')}
                    </div>
                    ${reservationNote}
                </div>
                <div class="item-price">
                    ${priceHTML}
                </div>
            </div>
        `;
    }).join('');
}

// Update the location name display
function updateLocationDisplay() {
    const nameEl = document.getElementById('locationName');
    if (!nameEl) return;
    
    const location = HONOUR_CONFIG.locations.find(l => l.id === currentLocation);
    nameEl.textContent = location ? location.name : 'Neutral Territory';
}

// Update the location status display
function updateLocationStatus() {
    const statusEl = document.getElementById('locationStatus');
    if (!statusEl) return;
    
    // Also update the location name
    updateLocationDisplay();
    
    const modInfo = getPriceModifier();
    const location = HONOUR_CONFIG.locations.find(l => l.id === currentLocation);
    
    if (!location || !location.clanId) {
        statusEl.innerHTML = `<span class="status-neutral">Standard prices</span>`;
        return;
    }
    
    if (modInfo.modifier === null) {
        statusEl.innerHTML = `
            <span class="status-hostile">
                <strong>${modInfo.status}</strong> (Score: ${modInfo.score}) — No trade permitted!
            </span>
        `;
        return;
    }
    
    let statusClass = 'status-neutral';
    if (modInfo.modifier > 0) statusClass = 'status-hostile';
    else if (modInfo.modifier < 0) statusClass = 'status-friendly';
    
    statusEl.innerHTML = `
        <span class="${statusClass}">
            <strong>${modInfo.status}</strong> (Score: ${modInfo.score}) — ${modInfo.label} prices
        </span>
    `;
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
    
    // Update location display (DM controls location via admin panel)
    updateLocationDisplay();
    updateLocationStatus();
    
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
    
    // Price with honour modifier
    const priceInfo = getAdjustedPrice(item.price);
    let priceDisplay;
    
    if (priceInfo.noTrade) {
        priceDisplay = `
            <div class="modal-price no-trade-price">
                <span class="modal-price-label">Price</span>
                <span class="modal-price-value no-trade-text">No Trade Permitted</span>
            </div>
            <div class="price-modifier-note hostile">
                Your standing with this clan (${priceInfo.modInfo.status}) prevents any trade.
            </div>
        `;
    } else if (priceInfo.modInfo.modifier !== 0) {
        const modClass = priceInfo.modInfo.modifier > 0 ? 'hostile' : 'friendly';
        priceDisplay = `
            <div class="modal-price">
                <span class="modal-price-label">Price</span>
                <span class="modal-price-value">${formatPriceFull(priceInfo.price)} GP</span>
            </div>
            <div class="price-modifier-note ${modClass}">
                ${priceInfo.modInfo.modifier > 0 ? '📈' : '📉'} ${priceInfo.modInfo.label} — ${priceInfo.modInfo.status} standing
                <span class="original-price">(Base: ${formatPriceFull(item.price)} GP)</span>
            </div>
        `;
    } else {
        priceDisplay = `
            <div class="modal-price">
                <span class="modal-price-label">Price</span>
                <span class="modal-price-value">${formatPriceFull(item.price)} GP</span>
            </div>
        `;
    }
    
    bodyHTML += `
        <div class="modal-section">
            ${priceDisplay}
        </div>
    `;
    
    // Check if item is legendary and show reservation info
    const isLegendary = rarity === 'legendary';
    const reservation = reservedItems[item.id];
    const deposit = Math.floor(priceInfo.price * 0.1); // Use adjusted price for deposit
    
    if (isLegendary && reservation) {
        // Show existing reservation info with timer
        const timeRemaining = getReservationTimeRemaining(reservation.reservedAt);
        const urgencyClass = timeRemaining.days <= 2 ? 'urgent' : (timeRemaining.days <= 5 ? 'warning' : '');
        
        bodyHTML += `
            <div class="modal-section">
                <div class="reservation-info-box">
                    <div class="reservation-info-header">📜 This Item is Reserved</div>
                    <div class="reservation-info-details">
                        <p><strong>${reservation.reservedBy}</strong> has placed a hold on this item.</p>
                        <p class="reservation-deposit">Deposit paid: <strong>${formatPriceFull(reservation.depositPaid)} GP</strong></p>
                        <p class="reservation-remaining">Remaining balance: <strong>${formatPriceFull(item.price - reservation.depositPaid)} GP</strong></p>
                        <div class="reservation-timer-box ${urgencyClass}">
                            <span class="timer-icon">⏳</span>
                            <span class="timer-label">Time remaining:</span>
                            <span class="timer-value">${timeRemaining.text}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (isLegendary) {
        // Show reservation option
        bodyHTML += `
            <div class="modal-section">
                <div class="reservation-offer-box">
                    <div class="reservation-offer-header">📜 Reserve This Item</div>
                    <p class="reservation-offer-text">Pay a <strong>${formatPriceFull(deposit)} GP</strong> deposit (10%) to reserve this legendary item for <strong>2 weeks</strong>. If not purchased within that time, the deposit is forfeited and the item becomes available again.</p>
                </div>
            </div>
        `;
    }
    
    // Action buttons
    bodyHTML += `
        <div class="modal-section modal-actions">
            <button class="copy-btn" onclick="copyItemToClipboard()">
                <span class="copy-btn-icon">📋</span>
                Copy for D&D Beyond
            </button>
    `;
    
    // Reservation/Purchase buttons for legendary items
    if (isLegendary) {
        if (reservation) {
            // Item is reserved - show complete purchase and cancel options
            bodyHTML += `
                <button class="purchase-btn" onclick="showPurchaseDialog()">
                    <span class="purchase-btn-icon">💰</span>
                    Complete Purchase (${formatPriceFull(item.price - reservation.depositPaid)} GP)
                </button>
                <button class="cancel-reservation-btn" onclick="showCancelReservationDialog()">
                    <span class="cancel-btn-icon">❌</span>
                    Cancel Reservation
                </button>
            `;
        } else {
            // Item not reserved - show reserve and purchase options
            bodyHTML += `
                <button class="reserve-btn" onclick="showReserveDialog()">
                    <span class="reserve-btn-icon">📜</span>
                    Reserve (${formatPriceFull(deposit)} GP deposit)
                </button>
                <button class="purchase-btn" onclick="showPurchaseDialog()">
                    <span class="purchase-btn-icon">💰</span>
                    Mark as Purchased
                </button>
            `;
        }
    } else if (isRareOrBetter) {
        // Rare items - just purchase button
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

function showReserveDialog() {
    if (!currentModalItem) return;
    
    const deposit = Math.floor(currentModalItem.price * 0.1);
    const playerName = prompt(`Who is reserving the ${currentModalItem.name}?\n\nEnter player/character name:`);
    
    if (playerName && playerName.trim()) {
        const confirmReserve = confirm(`📜 CONFIRM RESERVATION 📜\n\n${currentModalItem.name}\nReserved by: ${playerName.trim()}\nDeposit: ${formatPriceFull(deposit)} GP (10%)\n\nHave you paid the ${formatPriceFull(deposit)} GP deposit in D&D Beyond?\n\nThis item will be held for you until purchased.`);
        
        if (confirmReserve) {
            reserveItem(currentModalItem.id, playerName.trim());
            closeModal();
        }
    }
}

function showCancelReservationDialog() {
    if (!currentModalItem) return;
    
    const reservation = reservedItems[currentModalItem.id];
    if (!reservation) return;
    
    const confirmCancel = confirm(`❌ CANCEL RESERVATION ❌\n\n${currentModalItem.name}\nReserved by: ${reservation.reservedBy}\nDeposit paid: ${formatPriceFull(reservation.depositPaid)} GP\n\n⚠️ The deposit is NON-REFUNDABLE!\n\nAre you sure you want to cancel this reservation?`);
    
    if (confirmCancel) {
        cancelReservation(currentModalItem.id);
        closeModal();
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
window.showReserveDialog = showReserveDialog;
window.showCancelReservationDialog = showCancelReservationDialog;

// ===================================
// DM ADMIN PANEL
// ===================================

async function removePurchase(itemId) {
    if (!firebaseEnabled) {
        alert('Firebase is not connected. Cannot remove purchase.');
        return;
    }
    
    try {
        await remove(ref(db, `purchased/${itemId}`));
        console.log('Purchase removed:', itemId);
        return true;
    } catch (error) {
        console.error('Failed to remove purchase:', error);
        alert('Failed to remove purchase. Please try again.');
        return false;
    }
}

function showDMAdminPanel() {
    // Create admin overlay if it doesn't exist
    let adminOverlay = document.getElementById('adminOverlay');
    if (!adminOverlay) {
        adminOverlay = document.createElement('div');
        adminOverlay.id = 'adminOverlay';
        adminOverlay.className = 'modal-overlay';
        adminOverlay.innerHTML = `
            <div class="modal admin-modal">
                <button class="modal-close" id="adminClose">&times;</button>
                <div class="modal-header">
                    <h2 class="modal-title">🏰 DM Admin Panel</h2>
                </div>
                <div class="modal-body" id="adminBody">
                    Loading...
                </div>
            </div>
        `;
        document.body.appendChild(adminOverlay);
        
        // Add styles for admin panel
        const style = document.createElement('style');
        style.textContent = `
            .admin-modal {
                max-width: 600px;
                max-height: 80vh;
            }
            .admin-section {
                margin-bottom: 1.5rem;
            }
            .admin-section-title {
                font-size: 1rem;
                color: var(--gold);
                margin-bottom: 0.75rem;
                border-bottom: 1px solid var(--border);
                padding-bottom: 0.5rem;
            }
            .purchased-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                background: rgba(0,0,0,0.3);
                border-radius: 8px;
                margin-bottom: 0.5rem;
            }
            .purchased-item-info {
                flex: 1;
            }
            .purchased-item-name {
                font-weight: 600;
                color: var(--gold);
            }
            .purchased-item-details {
                font-size: 0.8rem;
                color: var(--text-secondary);
                margin-top: 0.25rem;
            }
            .purchased-item.legendary .purchased-item-name {
                color: #ff8c00;
            }
            .purchased-item.rare .purchased-item-name {
                color: #a335ee;
            }
            .restore-btn {
                background: linear-gradient(135deg, #4a9c4a, #2d5a2d);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.2s;
            }
            .restore-btn:hover {
                background: linear-gradient(135deg, #5cb85c, #3d7a3d);
                transform: translateY(-1px);
            }
            .restore-all-btn {
                background: linear-gradient(135deg, #c9302c, #8b1a1a);
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                width: 100%;
                margin-top: 1rem;
                transition: all 0.2s;
            }
            .restore-all-btn:hover {
                background: linear-gradient(135deg, #d9534f, #a52a2a);
            }
            .admin-empty {
                text-align: center;
                padding: 2rem;
                color: var(--text-secondary);
            }
            .admin-warning {
                background: rgba(255, 140, 0, 0.1);
                border: 1px solid rgba(255, 140, 0, 0.3);
                border-radius: 8px;
                padding: 0.75rem;
                margin-bottom: 1rem;
                font-size: 0.85rem;
                color: #ffaa44;
            }
            .admin-location-section {
                background: rgba(100, 140, 180, 0.1);
                border: 1px solid rgba(100, 140, 180, 0.3);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1.5rem;
            }
            .admin-location-title {
                font-size: 1rem;
                color: #8bb8d8;
                margin-bottom: 0.75rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .admin-location-select {
                width: 100%;
                padding: 0.75rem;
                font-size: 1rem;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(100, 140, 180, 0.4);
                border-radius: 6px;
                color: var(--text-primary);
                cursor: pointer;
            }
            .admin-location-select:focus {
                outline: none;
                border-color: #8bb8d8;
            }
            .admin-location-status {
                margin-top: 0.75rem;
                font-size: 0.85rem;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(style);
        
        // Close handlers
        adminOverlay.addEventListener('click', (e) => {
            if (e.target === adminOverlay) closeDMAdminPanel();
        });
        document.getElementById('adminClose').addEventListener('click', closeDMAdminPanel);
    }
    
    renderAdminPanel();
    adminOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function renderAdminPanel() {
    const adminBody = document.getElementById('adminBody');
    const purchasedList = Object.entries(purchasedItems);
    const reservedList = Object.entries(reservedItems);
    
    // Get current location info
    const currentLoc = HONOUR_CONFIG.locations.find(l => l.id === currentLocation);
    const modInfo = getPriceModifier();
    
    // Build location selector options
    const locationOptions = HONOUR_CONFIG.locations.map(loc => 
        `<option value="${loc.id}" ${loc.id === currentLocation ? 'selected' : ''}>${loc.name}</option>`
    ).join('');
    
    // Start building HTML with location control at the top
    let html = `
        <div class="admin-location-section">
            <div class="admin-location-title">📍 Party Location</div>
            <select class="admin-location-select" id="adminLocationSelect" onchange="updatePartyLocation(this.value)">
                ${locationOptions}
            </select>
            <div class="admin-location-status">
                Current status: <strong>${modInfo.status}</strong> — ${modInfo.label} prices
            </div>
        </div>
    `;
    
    if (purchasedList.length === 0 && reservedList.length === 0) {
        html += `
            <div class="admin-empty">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">✨</div>
                <p>No items have been purchased or reserved yet!</p>
            </div>
        `;
        adminBody.innerHTML = html;
        return;
    }
    
    // Sort by date (newest first)
    purchasedList.sort((a, b) => (b[1].purchasedAt || 0) - (a[1].purchasedAt || 0));
    reservedList.sort((a, b) => (b[1].reservedAt || 0) - (a[1].reservedAt || 0));
    
    html += `
        <div class="admin-warning">
            ⚠️ <strong>DM Only:</strong> Manage purchases and reservations here.
        </div>
    `;
    
    // Reservations section
    if (reservedList.length > 0) {
        html += `
            <div class="admin-section">
                <h3 class="admin-section-title">📜 Reserved Items (${reservedList.length})</h3>
                ${reservedList.map(([itemId, data]) => {
                    const reserveDate = data.reservedAt ? new Date(data.reservedAt).toLocaleDateString() : 'Unknown';
                    const timeRemaining = getReservationTimeRemaining(data.reservedAt);
                    const urgencyClass = timeRemaining.days <= 2 ? 'color: #e07070;' : (timeRemaining.days <= 5 ? 'color: #d4b85a;' : 'color: #90c090;');
                    return `
                        <div class="purchased-item legendary">
                            <div class="purchased-item-info">
                                <div class="purchased-item-name">${data.itemName || itemId}</div>
                                <div class="purchased-item-details">
                                    Reserved by ${data.reservedBy || 'Unknown'} • Deposit: ${formatPriceFull(data.depositPaid || 0)} GP • ${reserveDate}
                                </div>
                                <div class="purchased-item-details" style="${urgencyClass} margin-top: 0.25rem;">
                                    ⏳ ${timeRemaining.text} remaining
                                </div>
                            </div>
                            <button class="restore-btn" style="background: linear-gradient(135deg, #8b4513, #5c3317);" onclick="adminCancelReservation('${itemId}')">
                                Cancel
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Purchases section
    if (purchasedList.length > 0) {
        html += `
            <div class="admin-section">
                <h3 class="admin-section-title">💰 Purchased Items (${purchasedList.length})</h3>
                ${purchasedList.map(([itemId, data]) => {
                    const rarity = (data.rarity || 'rare').toLowerCase();
                    const purchaseDate = data.purchasedAt ? new Date(data.purchasedAt).toLocaleDateString() : 'Unknown';
                    return `
                        <div class="purchased-item ${rarity}">
                            <div class="purchased-item-info">
                                <div class="purchased-item-name">${data.itemName || itemId}</div>
                                <div class="purchased-item-details">
                                    Bought by ${data.purchasedBy || 'Unknown'} • Week ${data.week || '?'} • ${purchaseDate}
                                </div>
                            </div>
                            <button class="restore-btn" onclick="restoreItem('${itemId}')">
                                Restore
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="restore-all-btn" onclick="restoreAllItems()">
                ⚠️ Restore ALL Purchased Items
            </button>
        `;
    }
    
    adminBody.innerHTML = html;
}

async function adminCancelReservation(itemId) {
    const reservation = reservedItems[itemId];
    const itemName = reservation?.itemName || itemId;
    
    if (confirm(`Cancel reservation for "${itemName}"?\n\nReserved by: ${reservation?.reservedBy || 'Unknown'}\nDeposit: ${formatPriceFull(reservation?.depositPaid || 0)} GP\n\nThis will make the item available again.`)) {
        const success = await cancelReservation(itemId);
        if (success) {
            renderAdminPanel();
        }
    }
}

async function restoreItem(itemId) {
    const item = purchasedItems[itemId];
    const itemName = item?.itemName || itemId;
    
    if (confirm(`Restore "${itemName}" to the shop?\n\nThis will make it available for purchase again.`)) {
        const success = await removePurchase(itemId);
        if (success) {
            renderAdminPanel();
        }
    }
}

async function restoreAllItems() {
    const count = Object.keys(purchasedItems).length;
    
    if (confirm(`⚠️ WARNING ⚠️\n\nThis will restore ALL ${count} purchased items to the shop!\n\nAre you sure?`)) {
        if (confirm(`FINAL CONFIRMATION\n\nRestore all ${count} items?\n\nThis cannot be undone easily.`)) {
            for (const itemId of Object.keys(purchasedItems)) {
                await removePurchase(itemId);
            }
            renderAdminPanel();
        }
    }
}

function closeDMAdminPanel() {
    const adminOverlay = document.getElementById('adminOverlay');
    if (adminOverlay) {
        adminOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Update party location in Firebase (DM only)
async function updatePartyLocation(locationId) {
    if (!firebaseEnabled) {
        alert('Firebase is not connected. Cannot update location.');
        return;
    }
    
    const location = HONOUR_CONFIG.locations.find(l => l.id === locationId);
    if (!location) return;
    
    try {
        await set(ref(db, 'partyLocation'), {
            locationId: locationId,
            locationName: location.name,
            updatedAt: Date.now()
        });
        console.log('Party location updated to:', location.name);
        
        // Update local state immediately
        currentLocation = locationId;
        updateLocationDisplay();
        updateLocationStatus();
        renderItems();
        renderAdminPanel();
    } catch (error) {
        console.error('Failed to update party location:', error);
        alert('Failed to update location. Please try again.');
    }
}

// Make admin functions globally available
window.restoreItem = restoreItem;
window.restoreAllItems = restoreAllItems;
window.adminCancelReservation = adminCancelReservation;
window.updatePartyLocation = updatePartyLocation;

// Secret keyboard shortcut for DM panel: Ctrl+Shift+D
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        showDMAdminPanel();
    }
});

// ===================================
// START
// ===================================

document.addEventListener('DOMContentLoaded', init);
