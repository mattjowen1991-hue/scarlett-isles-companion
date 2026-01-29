# 🏰 Knightly Treasures - DM Guide

## Overview

Knightly Treasures is a magic item shop for The Scarlett Isles D&D campaign. It runs **completely automatically** - no manual intervention needed for weekly rotations!

---

## 🔄 How the Weekly Rotation Works

### Fully Automated!

The shop inventory **automatically changes every Monday** based on the campaign week number. You don't need to do anything!

Here's what happens behind the scenes:

1. **Week Number Calculation**: The app calculates which week it is based on the campaign start date (February 3, 2026)
2. **Seeded Randomization**: Using the week number as a "seed," the app randomly selects items - but the same seed ALWAYS produces the same selection
3. **Everyone Sees the Same Thing**: Because it's seeded, every player opening the app sees the identical inventory

### Weekly Stock Rules

Each week, the shop displays:

| Rarity | Count | Selection Rule |
|--------|-------|----------------|
| **Legendary** | 4 | One per class (Fighter, Rogue, Ranger, Paladin) |
| **Rare** | 5 | At least one per class, rest random |
| **Uncommon** | 8 | Random selection |
| **Common** | 10 | Random selection |
| **TOTAL** | **27 items** | |

### When Does It Reset?

- **Every Monday at midnight** (based on the user's local time)
- Week 1 started: **February 3, 2026**
- The week number displays in the top-right corner of the app

---

## 💰 Purchase Tracking

### How It Works

When a player buys a **Rare** or **Legendary** item:

1. They tap the item to open details
2. Tap "Mark as Purchased"
3. Enter their character name
4. Confirm TWICE (to prevent accidents)
5. The item is recorded in Firebase and **disappears from the shop forever**

### What Gets Tracked

- **Rare & Legendary items**: Once purchased, GONE FOREVER. They will never appear in the shop again.
- **Common & Uncommon items**: NOT tracked. They rotate freely and can be "purchased" multiple times.

### Real-Time Sync

All players see purchases instantly! If PlayerA buys the Vorpal Sword, it disappears from PlayerB's screen within seconds (thanks to Firebase).

---

## 🛠️ DM Admin Tasks

### Things You DON'T Need To Do

- ❌ Manually rotate inventory (it's automatic)
- ❌ Update the week number (it's automatic)
- ❌ Sync player views (Firebase handles it)
- ❌ Track purchases in a spreadsheet (Firebase stores it)

### Things You MIGHT Want To Do

#### 1. View All Purchased Items

To see what's been bought, go to your Firebase Console:
1. Visit: https://console.firebase.google.com/project/scarlett-isles-companion/database/scarlett-isles-companion-default-rtdb/data
2. Click on "purchased" to see all purchased items with:
   - Item name
   - Who bought it
   - When they bought it
   - Which week

#### 2. Undo an Accidental Purchase

If someone marks an item as purchased by mistake:
1. Go to Firebase Console (link above)
2. Find the item under "purchased"
3. Click the "X" to delete that entry
4. The item will reappear in the shop

#### 3. Add New Items

To add more items to the shop:
1. Edit `items.json` in the GitHub repository
2. Follow the existing format for items
3. Commit and push - the site updates automatically

#### 4. Force a Specific Item to Appear

Currently not supported through the UI. You'd need to either:
- Add it as a guaranteed item in the code
- Or just tell players "this item is available this week" outside the app

---

## 📊 Current Inventory Stats

| Rarity | Total Available | Price Range |
|--------|-----------------|-------------|
| Legendary | 12 items | 30,000 - 55,000 GP |
| Rare | 31 items | 400 - 8,000 GP |
| Uncommon | 49 items | 100 - 800 GP |
| Common | 22 items | 1 - 50 GP |
| **TOTAL** | **114 items** | |

### Legendary Items in the Pool

| Item | Price | Classes |
|------|-------|---------|
| Robe of the Archmagi | 55,000 GP | Ranger |
| Vorpal Sword | 50,000 GP | Fighter |
| Sun Blade | 48,000 GP | Paladin, Fighter |
| Holy Avenger | 45,000 GP | Fighter, Paladin |
| Belt of Fire Giant Strength | 45,000 GP | Fighter, Paladin |
| Luck Blade | 42,000 GP | Rogue, Fighter |
| Staff of Power | 40,000 GP | Ranger |
| Dancing Sword | 38,000 GP | Fighter, Paladin, Rogue |
| Oathbow | 35,000 GP | Ranger, Fighter |
| Cloak of Arachnida | 35,000 GP | Rogue, Ranger |
| Bow of Warning | 32,000 GP | Ranger, Fighter |
| Cloak of Invisibility | 30,000 GP | Rogue, Ranger |

---

## 🎮 Player Instructions

Share this with your players:

### How to Use the Shop

1. **Browse**: Open the app and scroll through this week's items
2. **Filter**: Use tabs (Weapons/Armor/Gear) and rarity buttons to find what you want
3. **View Details**: Tap any item to see full description, stats, and lore
4. **Favourite**: Tap the ⭐ to save items you're interested in
5. **Buy**: When you purchase an item in-game:
   - Use "Copy for D&D Beyond" to get the item text
   - Add it to your D&D Beyond character
   - Tap "Mark as Purchased" (Rare/Legendary only)

### Installing the App

**iPhone:**
1. Open https://mattjowen1991-hue.github.io/scarlett-isles-companion/ in Safari
2. Tap Share button → "Add to Home Screen"

**Android:**
1. Open the link in Chrome
2. Tap Menu → "Add to Home Screen"

---

## 🔧 Technical Details

### Tech Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Hosting**: GitHub Pages (free)
- **Database**: Firebase Realtime Database (free tier)
- **PWA**: Installable on mobile devices

### Key Files
```
scarlett-isles-companion/
├── index.html      # Main page
├── app.js          # All the logic
├── styles.css      # Styling
├── items.json      # Item database (edit this to add items)
├── manifest.json   # PWA configuration
├── sw.js           # Service worker for offline support
└── *.png           # App icons
```

### Firebase Structure
```
scarlett-isles-companion-default-rtdb/
└── purchased/
    ├── vorpal-sword/
    │   ├── itemName: "Vorpal Sword"
    │   ├── purchasedBy: "Thorin"
    │   ├── purchasedAt: 1707123456789
    │   ├── week: 3
    │   └── rarity: "Legendary"
    └── flame-tongue-longsword/
        └── ...
```

### GitHub Repository
https://github.com/mattjowen1991-hue/scarlett-isles-companion

### Live Site
https://mattjowen1991-hue.github.io/scarlett-isles-companion/

---

## ❓ FAQ

**Q: What if the same Legendary shows up for two classes?**
A: The algorithm ensures each class gets a DIFFERENT legendary. If an item is suitable for multiple classes (like Holy Avenger for Fighter AND Paladin), it only counts for one slot.

**Q: Can players see what others have favourited?**
A: No, favourites are stored locally on each device. Only purchases are shared.

**Q: What happens when all Legendaries are purchased?**
A: The shop will show fewer Legendary items. If all 12 are bought, no Legendaries will appear until you add more to items.json.

**Q: Can I change the campaign start date?**
A: Yes, edit `CONFIG.campaignStart` in app.js. This will shift all week numbers.

**Q: How do I add a new class?**
A: Edit `CONFIG.classes` in app.js and add items with that class in their `suitableFor` array in items.json.

**Q: The app isn't updating after I pushed changes?**
A: GitHub Pages can take 1-2 minutes to deploy. Hard refresh (Ctrl+Shift+R) or clear cache if needed.

---

## 📞 Support

If something breaks or you need help:
1. Check the browser console for errors (F12 → Console)
2. Check Firebase Console for database issues
3. Ask Claude to help debug! 🤖

---

*May your players' purses be full and their purchases be wise!* 🎲⚔️
