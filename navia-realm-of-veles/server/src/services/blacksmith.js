// ==========================================
// ZAAWANSOWANY ALGORYTM RZEMIOSŁA (blacksmith.js)
// ==========================================

// 1. Właściwości materiałów (Mnożniki)
const MATERIALS = {
    // Drewno (wpływa na lekkość i elastyczność)
    'wood_birch': { name: 'Drewno Brzozowe', damageMod: 0.8, durMod: 0.7 },
    'wood_oak': { name: 'Drewno Dębowe', damageMod: 1.0, durMod: 1.2 },
    'wood_ash': { name: 'Czarny Jesion', damageMod: 1.3, durMod: 1.0 },

    // Ostrza/Groty (wpływa na obrażenia i wytrzymałość)
    'stone_carved': { name: 'Ciosany Kamień', damageMod: 0.7, durMod: 0.8 },
    'iron_ore': { name: 'Ruda Żelaza', damageMod: 1.1, durMod: 1.1 },
    'steel_ingot': { name: 'Sztaba Stali', damageMod: 1.5, durMod: 1.5 } // Na przyszłość
};

// 2. Baza Broni
const WEAPONS_BASE = {
    'sword': { name: 'Miecz', baseDamage: 10, baseDurability: 100, requires: ['blade', 'handle'] },
    'axe': { name: 'Topór', baseDamage: 12, baseDurability: 80, requires: ['blade', 'handle'] },
    'spear': { name: 'Włócznia', baseDamage: 8, baseDurability: 60, requires: ['blade', 'handle'] }
};

// 3. Główna funkcja kująca
function craftWeapon(weaponType, bladeMaterialId, handleMaterialId, blacksmithExp) {
    const weapon = WEAPONS_BASE[weaponType];
    const blade = MATERIALS[bladeMaterialId];
    const handle = MATERIALS[handleMaterialId];

    if (!weapon || !blade || !handle) {
        throw new Error("Nieznany schemat lub materiał!");
    }

    // Przeliczenie expa kowala na Poziom (ten sam wzór co wcześniej)
    const blacksmithLevel = Math.floor(Math.sqrt((blacksmithExp || 0) / 10)) + 1;

    // MATEMATYKA RZEMIOSŁA
    // Obrażenia = (Baza * Mnożnik Ostrza * Mnożnik Rękojeści) + (Poziom Kowala * 0.5)
    let finalDamage = Math.floor((weapon.baseDamage * blade.damageMod * handle.damageMod) + (blacksmithLevel * 0.5));

    // Wytrzymałość = (Baza * Mnożnik Ostrza) + (Poziom Kowala * 2)
    let finalDurability = Math.floor((weapon.baseDurability * blade.durMod) + (blacksmithLevel * 2));

    // Generowanie unikalnego ID dla konkretnej sztuki broni
    const uniqueId = 'wpn_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    return {
        id: uniqueId,
        type: weaponType,
        name: `${weapon.name} (${blade.name})`,
        damage: finalDamage,
        durability: finalDurability,
        maxDurability: finalDurability,
        crafterLevel: blacksmithLevel
    };
}

module.exports = { craftWeapon, MATERIALS };