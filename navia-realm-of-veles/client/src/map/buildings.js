// Globalna pamięć dostępnych zleceń
window.availableQuests = [
    // Tymczasowe, startowe zlecenia (później zastąpimy to danymi z serwera)
    { id: 'q1', title: 'Bestia z Mokradeł', desc: 'Utopce porwały wóz. Kto ubije bestie, otrzyma złoto!', rewardText: '150 💰', req: 'warrior' },
    { id: 'q2', title: 'Wataha Wilków', desc: 'Wilki podchodzą pod mury. Potrzeba zbrojnego do odstrzału.', rewardText: '80 💰, 20 🐻', req: 'warrior' }
];

// ==========================================
// SYSTEM POZIOMÓW I RANG (KROK 1)
// ==========================================
window.getSettlerLevelAndRank = function(exp, profession) {
    const rawExp = exp || 0;

    // WZÓR: Poziom = pierwiastek z (XP / 10).
    // Przykłady: 0 XP = 1 lvl | 40 XP = 3 lvl | 2500 XP = 16 lvl.
    const level = Math.floor(Math.sqrt(rawExp / 10)) + 1;

    let rank = "Praktykant";

    if (profession === 'warrior') {
        if (level >= 50) rank = "Czempion";
        else if (level >= 30) rank = "Weteran";
        else if (level >= 10) rank = "Woj";
        else rank = "Rekrut";
    } else {
        if (level >= 50) rank = "Mistrz Cechu";
        else if (level >= 30) rank = "Specjalista";
        else if (level >= 10) rank = "Czeladnik";
    }

    return { level, rank };
};
// ==========================================
// --- ODŚWIEŻANIE WIDOKU GRODU ---
// ==========================================
window.updateCityInterface = () => {
    const player = window.lastPlayerData; // Zakładam, że tu trzymasz dane gracza
    if (!player) return;

    // 1. Licznik populacji
    const popVal = document.getElementById('city-pop-val');
    const idleVal = document.getElementById('city-idle-val');
    if (popVal) popVal.innerText = `${player.settlers.length} / ${player.houses * 5}`;

    const idleCount = player.settlers.filter(s => s.status === 'idle').length;
    if (idleVal) idleVal.innerText = idleCount;

    // 2. Mini-lista dekretów
    const decreesMini = document.getElementById('decrees-list-mini');
    if (decreesMini && player.upgrades) {
        const active = player.upgrades.filter(u => u.includes('edict_'));
        if (active.length > 0) {
            decreesMini.innerHTML = active.map(u => `• ${u.replace('edict_', '').toUpperCase()}`).join('<br>');
        }
    }
};
// ==========================================
// --- SYSTEM RZEMIOSŁA (Zlecenia) ---
// ==========================================
window.craftItem = (itemId) => {
    console.log("Władyka zleca wyprodukowanie:", itemId);

    // Wysyłamy prośbę do serwera. Serwer sprawdzi, czy mamy surowce i złoto!
     window.socket.emit('craft_item', { item: itemId, amount: 1 });
};
// Dodaj wywołanie do openCityScreen
const originalOpenCityScreen = window.openCityScreen;
window.openCityScreen = (id) => {
    if (originalOpenCityScreen) originalOpenCityScreen(id);
    window.updateCityInterface();
};
// ==========================================
// --- RENDEROWANIE GOŚCI W KARCZMIE ---
// ==========================================
window.renderTavernLife = () => {
    const list = document.getElementById('tavern-patrons-list');
    if (!list) return;

    // Upewniamy się, że mamy dane gracza
    const player = window.lastPlayerData;
    if (!player || !player.settlers) {
        list.innerHTML = '<div style="color:#aaa; font-style:italic; padding:10px;">Karczma jest pusta...</div>';
        return;
    }

    // Szukamy osadników, którzy nic nie robią (są 'idle') i są wojownikami
    const idleWarriors = player.settlers.filter(s => s.status === 'idle' && s.profession === 'warrior');

    list.innerHTML = '';

    if (idleWarriors.length === 0) {
         list.innerHTML = '<div style="text-align: center; color:#aaa; font-style:italic; padding:10px;">Karczma świeci pustkami. Wszyscy wojownicy są w polu lub na musztrze.</div>';
         return;
    }

    idleWarriors.forEach(w => {
         const stats = window.getSettlerLevelAndRank(w.exp, w.profession);
         list.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 5px 10px; border: 1px solid #333; border-left: 3px solid #ffaa00; margin-bottom: 5px;">
                <b style="color:#d4af37; font-size:13px;">🍻 ${w.name}</b> <span style="font-size:10px; color:#aaa;">(${stats.rank}) raczy się miodem.</span>
            </div>
         `;
    });
};
// ==========================================
// --- RENDEROWANIE TABLICY ZLECEŃ ---
// ==========================================
window.renderTavernQuests = () => {
    const questsList = document.getElementById('tavern-quests-list');
    if (!questsList) return;

    questsList.innerHTML = '';

    // KLUCZOWA ZMIANA: Pobieramy zlecenia PROSTO z serwera (z pamięci gracza)!
    const player = window.lastPlayerData;
    const quests = player?.tavernQuests || [];

    if (quests.length === 0) {
        questsList.innerHTML = '<div style="text-align: center; color: #666; font-style: italic; margin-top: 10px;">Brak nowych zleceń. W okolicy panuje spokój.</div>';
        return;
    }

    quests.forEach(q => {
        questsList.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); border: 1px dashed #aaa; padding: 10px; border-left: 3px solid #8b0000; position: relative; margin-bottom: 5px;">
                <b style="color: #ffaa00; font-size: 14px;">${q.title}</b>
                <p style="font-size: 11px; color: #ccc; margin: 5px 0; font-style: italic;">"${q.desc}"</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                    <span style="font-size: 12px; color: #32cd32;">Nagroda: ${q.rewardText}</span>
                    <button onclick="startQuest('${q.id}')" style="background: #8b0000; color: white; border: 1px solid #ff4444; cursor: pointer; font-size: 11px; padding: 4px 8px; font-weight: bold; transition: 0.2s;">
                        Podejmij (Wymaga: Woj)
                    </button>
                </div>
            </div>
        `;
    });
};

window.startQuest = (questId) => {
    // Wysyłamy prośbę na serwer. Teraz to serwer zarządza questami!
     window.socket.emit('start_quest', { questId: questId });
};


// ==========================================
// --- RYSOWANIE BUDYNKÓW NA MAPIE ---
// ==========================================
window.drawBuildingOnMap = function(data) {
    if (window.buildingMarkers[data._id]) {
        window.map.removeLayer(window.buildingMarkers[data._id]);
    }

    let iconPath = 'assets/map_icons/city.png';
    let bName = 'Nieznany Obiekt';
    let iconSize = [64, 64];

    switch(data.type) {
        case 'city': iconPath = 'assets/map_icons/city.png'; bName = 'Wielki Gród'; iconSize = [80, 80]; break;
        case 'sawmill': iconPath = 'assets/map_icons/sawmill.png'; bName = 'Tartak'; break;
        case 'mine': iconPath = 'assets/map_icons/mine.png'; bName = 'Kopalnia'; break;
        case 'herbalist_hut': iconPath = 'assets/map_icons/herbalist_hut.png'; bName = 'Chata Zielarki'; break;
        case 'shrine': iconPath = 'assets/map_icons/shrine.png'; bName = 'Kaplica Welesa'; break;
        case 'watchtower': iconPath = 'assets/map_icons/watchtower.png'; bName = 'Wieża Strażnicza'; break;
        case 'hunter_hut': iconPath = 'assets/map_icons/hunter_hut.png'; bName = 'Chata Myśliwego'; break;
        case 'fields': iconPath = 'assets/map_icons/fields.png'; bName = 'Pola Uprawne'; break;
    }

    const icon = L.divIcon({
        html: `<img src="${iconPath}" style="width:100%; height:100%; filter: drop-shadow(0px 5px 5px rgba(0,0,0,0.5));" onerror="this.src='https://placehold.co/64x64/333/FFF?text=Brak+Grafiki'">`,
        className: '',
        iconSize: iconSize,
        iconAnchor: [iconSize[0]/2, iconSize[1]/2]
    });

    const marker = L.marker([data.location.lat, data.location.lng], { icon: icon }).addTo(window.map);
    marker.buildingData = data;

    let popupContent = `<div style="text-align: center; color: white; font-family: 'Cinzel', serif;">`;
    popupContent += `<h3 style="margin: 0; color: #d4af37;">${bName}</h3>`;

    if (data.type === 'city') {
        popupContent += `<p style="margin: 5px 0;">Skarbiec krainy</p>`;
        popupContent += `<button onclick="openCityScreen('${data._id}')" style="background: #8b0000; color: white; border: 1px solid #d4af37; padding: 5px 10px; cursor: pointer; width: 100%;">Zarządzaj</button>`;
    } else {
        popupContent += `<p style="margin: 5px 0;">Magazyn: ${data.storage.wood || 0}🪵 | ${data.storage.stone || 0}🪨</p>`;
        popupContent += `<button onclick="openBuildingScreen('${data._id}')" style="background: #333; color: white; border: 1px solid #d4af37; padding: 5px 10px; cursor: pointer; width: 100%;">Zarządzaj</button>`;
    }
    popupContent += `</div>`;

    marker.bindPopup(popupContent);
    window.buildingMarkers[data._id] = marker;
};

// ==========================================
// --- GŁÓWNA FUNKCJA OTWIERANIA GRODU ---
// ==========================================
window.openCityScreen = (cityId) => {
    // 1. NAPRAWA BŁĘDU: Zapisujemy ID Grodu w pamięci!
    window.currentActiveCityId = cityId;

    // Pobieramy dane miasta z mapy
    const cityMarker = window.buildingMarkers[cityId];
    if (!cityMarker || !cityMarker.buildingData) return;
    const cityData = cityMarker.buildingData;

    // 2. CZYSZCZENIE WIDOKU: Najpierw ukrywamy wszystkie budynki
    document.querySelectorAll('.town-building-sprite').forEach(s => {
        s.style.display = 'none';
    });

    // Pokazujemy tło/mury
    const walls = document.getElementById('sprite-walls');
    if (walls) walls.style.display = 'block';

    // RATUSZ JEST ZAWSZE WIDOCZNY NA ŚRODKU PLACU!
    const townhall = document.getElementById('sprite-townhall');
    if (townhall) townhall.style.display = 'block';

    // 3. RENDEROWANIE ZBUDOWANYCH BUDYNKÓW
    if (cityData.upgrades) {
        cityData.upgrades.forEach(upgradeName => {
            // Pokazujemy grafikę na błotnistym placu
            const sprite = document.getElementById('sprite-' + upgradeName);
            if (sprite) sprite.style.display = 'block';

            // Wygaszamy przycisk w panelu rozbudowy
            const btn = document.getElementById('btn-' + upgradeName);
            if (btn) {
                btn.style.opacity = '0.4';
                btn.style.pointerEvents = 'none'; // Blokuje kolejne kliknięcia
                btn.style.border = '1px solid #32cd32';

                // Zmieniamy cenę na dumny napis "Wzniesiono"
                const priceSpan = btn.querySelector('span:last-child');
                if (priceSpan) {
                    priceSpan.style.color = '#32cd32';
                    priceSpan.innerText = 'Wzniesiono';
                }
            }
        });
    }

    // 4. Odświeżenie populacji i dekretów
    if (window.updateCityInterface) window.updateCityInterface();

    // 5. Otwarcie ekranu głównego Grodu
    document.getElementById('city-screen').classList.remove('hidden-display');
};


window.closeCityScreen = () => document.getElementById('city-screen').classList.add('hidden-display');

window.buildCityUpgrade = (type) => {
    if (!window.currentActiveCityId) return;
     window.socket.emit('upgrade_building_request', { buildingId: window.currentActiveCityId, upgradeType: type });
};

// ==========================================
// --- INTERAKCJE Z WEWNĘTRZNYMI BUDYNKAMI ---
// ==========================================
window.openBuildingAction = (type) => {
    console.log("Kliknięto budynek: " + type); // <-- To pokaże nam w konsoli, czy kliknięcie w ogóle działa!

    if (type === 'townhall') document.getElementById('townhall-modal').classList.remove('hidden-display');
    if (type === 'tavern') {
        document.getElementById('tavern-modal').classList.remove('hidden-display');
        window.renderTavernLife();
        window.renderTavernQuests();
    }
    if (type === 'market') document.getElementById('market-modal').classList.remove('hidden-display');
    if (type === 'blacksmith') document.getElementById('blacksmith-modal').classList.remove('hidden-display');
    if (type === 'barracks') {
        document.getElementById('barracks-modal').classList.remove('hidden-display');
         window.socket.emit('get_barracks_data'); // Odświeżamy listę przy każdym wejściu!
    }
    if (type === 'alchemist') document.getElementById('alchemist-modal').classList.remove('hidden-display');
    if (type === 'granary') document.getElementById('granary-modal').classList.remove('hidden-display');
    if (type === 'stables') document.getElementById('stables-modal').classList.remove('hidden-display');

    // Zabezpieczenie dla Kapitolu (wymaga zbudowania)
    if (type === 'capitol') {
        const cityMarker = Object.values(window.buildingMarkers).find(m => m.buildingData && m.buildingData.type === 'city');
        if (cityMarker && cityMarker.buildingData.upgrades.includes('capitol')) {
            document.getElementById('capitol-modal').classList.remove('hidden-display');
        } else {
            alert("❌ Musisz najpierw wznieść Kapitol w menu Rozbudowy Osady na dole ekranu Grodu!");
        }
    }
};

// Kuźnia
window.craftWeapons = () => {
    const amt = parseInt(document.getElementById('craft-weapons-amt').value) || 0;
    if (amt > 0)  window.socket.emit('craft_weapons', { amount: amt });
    document.getElementById('blacksmith-modal').classList.add('hidden-display');
};
// Alchemik
window.brewPotions = () => {
    const amt = parseInt(document.getElementById('craft-potions-amt').value) || 0;
    if (amt > 0)  window.socket.emit('brew_potions', { amount: amt });
    document.getElementById('alchemist-modal').classList.add('hidden-display');
};
// Koszary
window.recruitPeasants = () => {
    const count = parseInt(document.getElementById('rec-peasant').value) || 0;
    if (count > 0) {
         window.socket.emit('recruit_units', { peasants: count, warriors: 0 });
    }
};

window.recruitWarriors = () => {
    const count = parseInt(document.getElementById('rec-warrior').value) || 0;
    if (count > 0) {
         window.socket.emit('recruit_units', { peasants: 0, warriors: count });
    }
};

// --- SPICHLERZ: Nakarm osadników ---
window.feedSettlers = () => {
     window.socket.emit('feed_settlers');
    document.getElementById('granary-modal').classList.add('hidden-display');
};

// Targowisko
window.tradeResource = (action, resource) => {
     window.socket.emit('trade_resources', { action: action, resource: resource });
};
// Kupowanie wozu w stajni
window.buyCaravan = () => {
     window.socket.emit('buy_caravan');
    document.getElementById('stables-modal').classList.add('hidden-display');
};

// --- KARCZMA: Biesiada ---
window.holdFeast = () => {
     window.socket.emit('hold_feast');
    document.getElementById('tavern-modal').classList.add('hidden-display');
};

// ==========================================
// --- RENDEROWANIE ZAWARTOŚCI PLACÓWKI ---
// ==========================================
window.updateBuildingStorageUI = (bData) => {
    const container = document.getElementById('bs-storage-list');
    if (!container) return;
    container.innerHTML = '';

    let total = 0;
    const addRes = (icon, name, amount, color) => {
        if (amount > 0) {
            total += amount;
            container.innerHTML += `<div style="background: rgba(0,0,0,0.5); padding: 5px 10px; border: 1px solid ${color}; border-radius: 4px; font-weight: bold; font-size: 13px;">${icon} ${name}: <span style="color:${color}">${amount}</span></div>`;
        }
    };

    if (bData.type === 'sawmill') {
        document.getElementById('bs-icon').innerText = '🌲';
        addRes('🌲', 'Brzoza', bData.storage.wood_birch || 0, '#aaddaa');
        addRes('🌲', 'Dąb', bData.storage.wood_oak || 0, '#8b4513');
        addRes('🌲', 'Jesion', bData.storage.wood_ash || 0, '#555555');
    } else if (bData.type === 'mine') {
        document.getElementById('bs-icon').innerText = '⛏️';
        addRes('🪨', 'Kamień', bData.storage.stone || 0, '#aaaaaa');
        addRes('⛏️', 'Żelazo', bData.storage.iron || 0, '#777777');
    } else if (bData.type === 'herbalist_hut') {
        document.getElementById('bs-icon').innerText = '🛖';
        addRes('🌿', 'Jaskółcze Ziele', bData.storage.herb_celandine || 0, '#32cd32');
        addRes('🌿', 'Wilczy Mlecz', bData.storage.herb_wolfsbane || 0, '#9370db');
    }
    // --- Tutaj jest dodana logika dla Myśliwego i Pól! ---
    else if (bData.type === 'hunter_hut') {
        document.getElementById('bs-icon').innerText = '🏹';
        addRes('🌾', 'Żywność', bData.storage.food || 0, '#f4a460');
        addRes('🐻', 'Skóry', bData.storage.pelts || 0, '#8b4513');
    } else if (bData.type === 'fields') {
        document.getElementById('bs-icon').innerText = '🌾';
        addRes('🌾', 'Żywność', bData.storage.food || 0, '#f4a460');
    }

    if (total === 0) container.innerHTML = '<span style="color:#aaa;">Magazyn jest pusty</span>';
};
// ==========================================
// --- EKRAN ZEWNĘTRZNYCH PLACÓWEK ---
// ==========================================
const buildingUpgradesDef = {
    'sawmill': [
        { id: 'sharp_axes', name: 'Ostre Siekiery', desc: '+8 Drewna/cykl', cost: '150💰 50🪨', icon: '🪓' },
        { id: 'heavy_carts', name: 'Ciężkie Wozy', desc: '+100 Pojemności', cost: '200💰 100🪵', icon: '🛒' }
    ],
    'mine': [
        { id: 'deep_shaft', name: 'Głęboki Szyb', desc: '+5 Kamienia/cykl', cost: '250💰 150🪵', icon: '🕳️' }
    ],
    'shrine': [
        { id: 'blessing_wealth', name: 'Dar Welesa', desc: 'Pasywne Złoto', cost: '500💰', icon: '✨' }
    ],
    'herbalist_hut': [
        { id: 'sharp_sickles', name: 'Ostre Sierpy', desc: '+5 Ziół/cykl', cost: '150💰 50🪵', icon: '🌿' },
        { id: 'drying_racks', name: 'Suszarnie', desc: '+100 Pojemności', cost: '200💰 100🪵', icon: '☀️' }
    ],
    'fields': [
        { id: 'iron_plows', name: 'Żelazne Pługi', desc: '+8 Żywności/cykl', cost: '300💰 100🪨', icon: '🚜' },
        { id: 'scarecrows', name: 'Straszaki', desc: 'Mniejsze straty', cost: '100💰 50🪵', icon: '🌾' }
    ],
    'watchtower': []
};

window.openBuildingScreen = (id) => {
    const bData = window.buildingMarkers[id].buildingData;
    if(window.updateBuildingStorageUI && bData) {
        window.updateBuildingStorageUI(bData);
    }
    // Oświeża listy pracowników w Placówkach
    window.renderBuildingPersonnel = () => {
        if (!window.currentActiveCityId) return;
        const bMarker = window.buildingMarkers[window.currentActiveCityId];
        if (!bMarker) return;
        const bType = bMarker.buildingData.type;

        const idleList = document.getElementById('bs-idle-list');
        const assignedList = document.getElementById('bs-assigned-list');
        if(!idleList || !assignedList) return;

        idleList.innerHTML = '';
        assignedList.innerHTML = '';

        const idleSettlers = window.mySettlers.filter(s => ['idle', 'returning_home', 'resting'].includes(s.status));
        const assignedSettlers = window.mySettlers.filter(s => ['working', 'walking_to_work'].includes(s.status) && s.workplaceId === window.currentActiveCityId);

        const header = document.getElementById('bs-personnel-header');
        if (header) header.innerText = `Zarządzanie Personelem (${assignedSettlers.length}/5 Miejsc)`;

        // --- CZYSTA MATEMATYKA WYDOBYCIA ---
        const calcProd = (s) => {
            if (!s) return '';
            if (s.profession === 'warrior') return `<span style="color:#ff6666;">🛡️ Ochrona Obiektu</span>`;

            const stats = window.getSettlerLevelAndRank(s.exp, s.profession);
            const pLevel = stats.level;

            let baseBonus = 0;
            if (s.trait && s.trait.includes('Krzepki')) baseBonus += 2;
            if (s.trait && s.trait.includes('Pijak')) baseBonus -= 2;

            if (bType === 'sawmill') {
                if (s.profession === 'peasant') return `<span style="color:#d4af37;">+${Math.max(1, (1 + baseBonus + pLevel) * 2)} 🪵/cykl</span>`;
                if (s.profession === 'woodcutter') return `<span style="color:#d4af37;">+${Math.max(1, (4 + baseBonus + pLevel) * 2)} 🪵/cykl</span>`;
            }
            if (bType === 'mine') {
                if (s.profession === 'peasant') return `<span style="color:#a9a9a9;">+${Math.max(1, 1 + baseBonus + pLevel)} 🪨/cykl</span>`;
                if (s.profession === 'miner') return `<span style="color:#a9a9a9;">+${Math.max(1, 3 + baseBonus + pLevel)} 🪨/cykl</span>`;
            }
            if (bType === 'herbalist_hut') {
                if (s.profession === 'peasant') return `<span style="color:#32cd32;">+${Math.max(1, (1 + baseBonus + pLevel) * 2)} 🌿/cykl</span>`;
                if (s.profession === 'herbalist') return `<span style="color:#32cd32;">+${Math.max(1, (3 + baseBonus + pLevel) * 2)} 🌿/cykl</span>`;
            }
            if (bType === 'hunter_hut') {
                if (s.profession === 'peasant') return `<span style="color:#f4a460;">+${Math.max(1, (1 + baseBonus + pLevel) * 2)} 🌾/cykl</span>`;
                if (s.profession === 'hunter') return `<span style="color:#f4a460;">+${Math.max(1, (4 + baseBonus + pLevel) * 2)} 🌾/cykl</span>`;
            }
            if (bType === 'fields') {
                if (s.profession === 'peasant') return `<span style="color:#f4a460;">+${Math.max(1, (2 + baseBonus + pLevel) * 2)} 🌾/cykl</span>`;
                if (s.profession === 'farmer') return `<span style="color:#f4a460;">+${Math.max(1, (5 + baseBonus + pLevel) * 2)} 🌾/cykl</span>`;
            }
            return `<span style="color:#888;">Brak fachu</span>`;
        }

        const isFull = assignedSettlers.length >= 5;

        // --- RENDEROWANIE WOLNYCH OSADNIKÓW ---
        idleSettlers.forEach(s => {
            let icon = '🧍';
            if (s.profession === 'woodcutter') icon = '🪓';
            else if (s.profession === 'miner') icon = '⛏️';
            else if (s.profession === 'herbalist') icon = '🌿';
            else if (s.profession === 'warrior') icon = '⚔️';

            const stats = window.getSettlerLevelAndRank(s.exp, s.profession);

            let actionHTML = '';
            if (s.status === 'idle') {
                if (isFull) {
                    actionHTML = `<span style="font-size: 10px; color: #ff4444; font-weight: bold;">Brak miejsc</span>`;
                } else {
                    actionHTML = `<button onclick="window.socket.emit('assign_worker', { settlerId: '${s._id}', buildingId: '${currentActiveCityId}' })" style="background: #32cd32; color: #000; border: none; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-weight: bold;">Wyślij ➔</button>`;
                }
            }
            else if (s.status === 'returning_home') actionHTML = `<span style="font-size: 10px; color: #aaa; font-style: italic;">🚶 Wraca...</span>`;
            else if (s.status === 'resting') actionHTML = `<span style="font-size: 10px; color: #aaa; font-style: italic;">🛌 Odpoczywa...</span>`;

            idleList.innerHTML += `
                <div style="background: #222; padding: 5px; border: 1px solid #555; display: flex; justify-content: space-between; align-items: center; font-size: 12px; border-radius: 3px; margin-bottom: 5px;">
                    <div>
                        <span>${icon} <b>${s.name}</b> <span style="font-size:10px;">(${calcProd(s)})</span></span><br>
                        <span style="font-size: 10px; color: #d4af37;">${stats.rank} (Poz. ${stats.level})</span>
                    </div>
                    ${actionHTML}
                </div>
            `;
        });

        // --- RENDEROWANIE ZATRUDNIONYCH ---
        assignedSettlers.forEach(s => {
            let icon = '🧍';
            if (s.profession === 'woodcutter') icon = '🪓';
            else if (s.profession === 'miner') icon = '⛏️';
            else if (s.profession === 'herbalist') icon = '🌿';
            else if (s.profession === 'warrior') icon = '⚔️';

            const stats = window.getSettlerLevelAndRank(s.exp, s.profession);

            let actionHTML = '';
            let statusLabel = '';

            if (s.status === 'working') {
                statusLabel = `<span style="color: #32cd32; font-size: 10px; margin-left: 10px;">(⚒️ Pracuje)</span>`;
                actionHTML = `<button onclick="window.socket.emit('unassign_worker', { settlerId: '${s._id}' })" style="background: #8b0000; color: #fff; border: none; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-weight: bold;">⬅ Wróć</button>`;
            } else if (s.status === 'walking_to_work') {
                statusLabel = `<span style="color: #aaa; font-size: 10px; margin-left: 10px; font-style: italic;">(🚶 Zmierza...)</span>`;
                actionHTML = `<span style="font-size: 10px; color: #aaa; font-style: italic;">W drodze...</span>`;
            }

            assignedList.innerHTML += `
                <div style="background: rgba(0,0,0,0.6); padding: 8px; margin-bottom: 5px; border: 1px solid #5a4529; border-left: 3px solid #32cd32; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span>${icon} <b style="color: #f0e6d2; font-size: 14px;">${s.name}</b> ${statusLabel}</span><br>
                        <span style="font-size: 11px; color: #d4af37; font-weight: bold;">${stats.rank} (Poz. ${stats.level})</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 12px; font-weight: bold;">${calcProd(s)}</span><br>
                        ${actionHTML}
                    </div>
                </div>
            `;
        });
    };
    window.currentActiveCityId = id;
    const b = window.buildingMarkers[id].buildingData;

    const titles = {'sawmill':'Tartak', 'mine':'Kopalnia', 'watchtower':'Wieża', 'shrine':'Kaplica Welesa', 'herbalist_hut':'Chata Zielarki'};
    const icons = {'sawmill':'🌲', 'mine':'⛏️', 'watchtower':'🗼', 'shrine':'🗿', 'herbalist_hut':'🍄'};
    document.getElementById('bs-title').innerText = titles[b.type] || 'Budynek';
    document.getElementById('bs-icon').innerText = icons[b.type] || '🏗️';

    const upgradesContainer = document.getElementById('bs-upgrades');
    upgradesContainer.innerHTML = '';

    const availableUpgrades = buildingUpgradesDef[b.type] || [];
    availableUpgrades.forEach(u => {
        const isBuilt = b.upgrades.includes(u.id);
        const builtClass = isBuilt ? 'built-btn' : '';
        upgradesContainer.innerHTML += `
            <div class="upgrade-item ${builtClass}" onclick="window.socket.emit('upgrade_building_request', {buildingId: '${id}', upgradeType: '${u.id}'})">
                <div style="font-size:30px;">${u.icon}</div>
                <b>${u.name}</b><br>
                <span style="font-size:10px; color:#aaa;">${u.desc}</span><br>
                <span style="color:#8b0000; font-size:11px;">${isBuilt ? 'WYKUPIONE' : u.cost}</span>
            </div>
        `;
    });
    renderBuildingPersonnel(); // Renderujemy ludzi przed otwarciem okna
    document.getElementById('building-screen').classList.remove('hidden-display');
    window.map.closePopup();
};

window.closeBuildingScreen = () => document.getElementById('building-screen').classList.add('hidden-display');

// ==========================================
// --- LOGIKA WYSUWANYCH PANELI W GRODZIE ---
// ==========================================
window.toggleCityPanel = (panelId, btnElement) => {
    const panels = ['panel-build', 'panel-pop', 'panel-log'];
    const buttons = document.querySelectorAll('.city-tab-btn');

    buttons.forEach(b => b.classList.remove('active-tab'));

    panels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (id === panelId) {
            if (el.classList.contains('active')) {
                el.classList.remove('active');
            } else {
                el.classList.add('active');
                btnElement.classList.add('active-tab');

                // DODANO: Gdy gracz otwiera panel Wypraw, generujemy listę!
                if (panelId === 'panel-pop') {
                    window.renderExplorationPanel();
                }
            }
        } else {
            el.classList.remove('active');
        }
    });
};

// ==========================================
// --- WYSYŁANIE ZLECENIA BUDOWY ---
// ==========================================
window.buildCityUpgrade = (upgradeType) => {
    // Sprawdzamy, czy Władyka wybrał poprawne miasto z mapy
    if (!window.currentActiveCityId) {
        alert("Błąd: Nie wybrano Grodu do rozbudowy.");
        return;
    }

    console.log(`Zlecam budowę: ${upgradeType} w mieście ${window.currentActiveCityId}`);

    // Wysyłamy sygnał na serwer. Pamiętaj, że serwer oczekuje 'upgrade_building_request'
     window.socket.emit('upgrade_building_request', {
        buildingId: window.currentActiveCityId,
        upgradeType: upgradeType
    });
};
// ==========================================
// ZBROJOWNIA - LOGIKA KLIENTA
// ==========================================

// Funkcja otwierająca okno i wysyłająca zapytanie do serwera
window.openArmory = function() {
    document.getElementById('armory-modal').classList.remove('hidden-display');
    // Wyświetlamy loader dopóki serwer nie odpowie
    document.getElementById('armory-list-container').innerHTML = '<div style="grid-column: span 2; text-align: center; color: #5a4529; font-weight: bold; padding-top: 20px;">Otwieranie ciężkich wrót...</div>';

     window.socket.emit('get_armory_request');
};
setTimeout(() => {
    // ==========================================
    // ZBROJOWNIA - LOGIKA KLIENTA
    // ==========================================
     window.socket.on('armory_data', (data) => {
        const container = document.getElementById('armory-list-container');
        let html = '';

        // 1. POBIERANIE ZWYKŁYCH BRONI (Seryjna produkcja) ze Skarbca
        const res = window.lastPlayerData?.resources || {};
        const standardWeapons = [
            { id: 'std_sword', name: 'Żelazny Miecz', type: 'sword', count: res.wpn_sword || 0, dmg: 10 },
            { id: 'std_axe', name: 'Topór', type: 'axe', count: res.wpn_axe || 0, dmg: 12 },
            { id: 'std_bow', name: 'Cisowy Łuk', type: 'bow', count: res.wpn_bow || 0, dmg: 8 },
            { id: 'std_spear', name: 'Włócznia', type: 'spear', count: res.wpn_spear || 0, dmg: 9 },
            { id: 'std_shd_wood', name: 'Drewniany Puklerz', type: 'shield', count: res.shd_wood || 0, dmg: 0 },
            { id: 'std_shd_iron', name: 'Okuta Tarcza', type: 'shield', count: res.shd_iron || 0, dmg: 0 }
        ];

        standardWeapons.forEach(w => {
            if (w.count > 0) {
                let icon = '🗡️';
                if (w.type === 'axe') icon = '🪓';
                if (w.type === 'bow') icon = '🏹';
                if (w.type === 'spear') icon = '🔱';
                if (w.type === 'shield') icon = '🛡️';

                html += `
                <div class="armory-card" style="background: rgba(0,0,0,0.8); border: 1px solid #5a4529; border-left: 3px solid #888; padding: 8px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);">
                    <div style="font-size: 12px; font-weight: 900; color: #fff; border-bottom: 1px dashed #5a4529; padding-bottom: 4px; margin-bottom: 6px; text-transform: uppercase;">
                        ${icon} ${w.name} <span style="color:#32cd32; float:right;">x${w.count}</span>
                    </div>
                    <div style="font-size: 10px; color: #b0a080; line-height: 1.4;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Obrażenia / Klasa:</span>
                            <b style="color: #ffaa00;">${w.dmg}</b>
                        </div>
                    </div>
                    <div style="font-size: 8px; color: #666; text-align: right; margin-top: 4px; font-style: italic;">Seryjna produkcja</div>
                </div>`;
            }
        });

        // 2. UNIKALNE BRONIE (Jeśli jakieś posiadasz wygenerowane przez mistrza)
        const armory = data.armory || [];
        armory.forEach(item => {
            let icon = '🗡️';
            if (item.type === 'axe') icon = '🪓';
            if (item.type === 'spear') icon = '🔱';
            if (item.type === 'bow') icon = '🏹';

            html += `
            <div class="armory-card" style="background: rgba(0,0,0,0.8); border: 1px solid #2b1d0f; border-left: 3px solid #6b1c1c; padding: 8px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);">
                <div style="font-size: 12px; font-weight: 900; color: #d4af37; border-bottom: 1px dashed #5a4529; padding-bottom: 4px; margin-bottom: 6px; text-transform: uppercase;">
                    ${icon} ${item.name}
                </div>
                <div style="font-size: 10px; color: #b0a080; line-height: 1.4;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Obrażenia:</span>
                        <b style="color: #ff4444;">${item.damage}</b>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Stan:</span>
                        <b style="color: #90ee90;">${item.durability} / ${item.maxDurability}</b>
                    </div>
                </div>
                <div style="font-size: 8px; color: #d4af37; text-align: right; margin-top: 4px;">Mistrzowska Jakość</div>
            </div>`;
        });

        if (html === '') {
            container.innerHTML = '<div style="grid-column: span 2; text-align: center; color: #8b0000; font-weight: bold; padding-top: 20px; font-size: 14px;">Zbrojownia świeci pustkami, Władyko.<br><span style="font-size:11px; color:#5a4529;">(Zbuduj Kuźnię i wyprodukuj oręż)</span></div>';
        } else {
            container.innerHTML = html;
        }
    });
}, 500);
// ==========================================
// --- SYSTEM ZAAWANSOWANEJ PŁATNOŚCI ---
// ==========================================

const UPGRADE_COSTS = {
    'tavern': { name: 'Karczma', gold: 200, wood: 100, stone: 0 },
    'market': { name: 'Targowisko', gold: 300, wood: 150, stone: 50 },
    'blacksmith': { name: 'Kuźnia', gold: 400, wood: 100, stone: 200 },
    'barracks': { name: 'Koszary', gold: 500, wood: 200, stone: 100 },
    'alchemist': { name: 'Chata Alchemika', gold: 1000, wood: 200, stone: 200 },
    'stables': { name: 'Stajnie', gold: 300, wood: 200, stone: 0 },
    'granary': { name: 'Spichlerz', gold: 200, wood: 200, stone: 0 },
    'walls': { name: 'Potężne Mury', gold: 500, wood: 0, stone: 500 },
    'capitol': { name: 'Kapitol', gold: 2000, wood: 500, stone: 500 },
    'farm': { name: 'Farma Zwierząt', gold: 300, wood: 150, stone: 0 },
};

window.currentBuildRequest = null;

// Podmieniamy starą funkcję na nową
window.buildCityUpgrade = (upgradeType) => {
    // NAPRAWA: Pobieramy poprawne ID Grodu z obu możliwych miejsc w pamięci
    const activeCity = window.currentActiveCityId || currentActiveCityId;
    if (!activeCity) return alert("Błąd: Nie wybrano Grodu.");

    const cost = UPGRADE_COSTS[upgradeType];
    if (!cost) return;

    window.currentBuildRequest = { type: upgradeType, cost: cost };

    document.getElementById('payment-title').innerText = `Budowa: ${cost.name}`;
    document.getElementById('payment-gold-cost').innerText = `${cost.gold} 💰`;

    const playerRes = window.lastPlayerData?.resources || {}; // Upewnij się, że masz zapisane zasoby gracza!

    // Renderowanie sekcji Drewna
    renderPaymentSection('wood', cost.wood, window.GAME_RESOURCES.categories.wood, playerRes);

    // Renderowanie sekcji Kamienia
    renderPaymentSection('stone', cost.stone, window.GAME_RESOURCES.categories.stone, playerRes);

    validatePayment(); // Sprawdza od razu, czy przycisk ma być aktywny
    document.getElementById('payment-modal').classList.remove('hidden-display');
};

// --- OBLICZANIE PROCENTÓW NA ŻYWO ---
// --- OBLICZANIE WYNIKÓW NA ŻYWO (Twarde liczby, bez przekraczania 100%) ---
// --- INTELIGENTNA BLOKADA SUWAKÓW ---
// --- INTELIGENTNA BLOKADA SUWAKÓW ---
window.handleSliderChange = (inputEl, category, reqAmount) => {
    let currentVal = parseInt(inputEl.value) || 0;

    // 1. Sumujemy wartości z POZOSTAŁYCH suwaków w tej samej kategorii
    let sumOthers = 0;
    document.querySelectorAll(`.pay-input-${category}`).forEach(input => {
        if (input !== inputEl) {
            sumOthers += parseInt(input.value) || 0;
        }
    });

    // 2. Obliczamy maksymalne miejsce dla TEGO suwaka
    let maxAllowed = reqAmount - sumOthers;
    if (maxAllowed < 0) maxAllowed = 0;

    // 3. Sprawdzamy dodatkowo, czy gracz w ogóle ma tyle surowca w Skarbcu
    let actualMax = parseInt(inputEl.dataset.max) || 0;
    maxAllowed = Math.min(maxAllowed, actualMax);

    // 4. FIZYCZNA BLOKADA - cofa suwak, jeśli przeciągniesz za daleko!
    if (currentVal > maxAllowed) {
        inputEl.value = maxAllowed;
        currentVal = maxAllowed;
    }

    // 5. Aktualizujemy widoczną cyferkę
    const disp = document.getElementById(`val-disp-${inputEl.dataset.res}`);
    if (disp) disp.innerText = currentVal;

    // 6. Odświeżamy sumy w prawym rogu (np. 200/200)
    window.validatePayment();
};

function renderPaymentSection(category, requiredAmount, resourceKeys, playerRes) {
    const section = document.getElementById(`payment-${category}-section`);
    const container = document.getElementById(`payment-${category}-inputs`);

    if (requiredAmount <= 0) {
        section.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';

    // Algorytm równego podziału (bez zmian)
    let availableKeys = resourceKeys.filter(k => (playerRes[k] || 0) > 0);
    let defaultValues = {};
    availableKeys.forEach(k => defaultValues[k] = 0);

    let remainingToFulfill = requiredAmount;
    let keysLeft = [...availableKeys];

    while (remainingToFulfill > 0 && keysLeft.length > 0) {
        let portion = Math.ceil(remainingToFulfill / keysLeft.length);
        let changesMade = false;
        for (let i = keysLeft.length - 1; i >= 0; i--) {
            let k = keysLeft[i];
            let avail = playerRes[k] || 0;
            let space = avail - defaultValues[k];
            let toAdd = Math.min(portion, space, remainingToFulfill);
            if (toAdd > 0) {
                defaultValues[k] += toAdd;
                remainingToFulfill -= toAdd;
                changesMade = true;
            }
            if (defaultValues[k] >= avail) keysLeft.splice(i, 1);
        }
        if (!changesMade) break;
    }

    // Renderowanie suwaków z agresywną czytelnością
    resourceKeys.forEach(resKey => {
        const available = playerRes[resKey] || 0;
        const dict = window.GAME_RESOURCES.dict[resKey] || { name: resKey, icon: '📦' };
        const defVal = defaultValues[resKey] || 0;
        const sliderMax = Math.min(available, requiredAmount);

        const opacity = available > 0 ? '1' : '0.4';
        const pointer = available > 0 ? 'auto' : 'none';

        container.innerHTML += `
            <div style="opacity: ${opacity}; pointer-events: ${pointer}; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-size: 13px; color: #000; font-weight: 900; text-transform: uppercase; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">
                        ${dict.icon} ${dict.name}
                    </span>
                    <b style="color: #8b0000; font-size: 16px; font-weight: 900; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);" id="val-disp-${resKey}">${defVal}</b>
                </div>
                <input type="range" class="pay-input-${category}"
                    data-res="${resKey}"
                    data-max="${sliderMax}"
                    value="${defVal}"
                    min="0" max="${sliderMax}"
                    oninput="window.handleSliderChange(this, '${category}', ${requiredAmount})"
                    style="width: 100%; cursor: pointer; accent-color: #8b0000; height: 10px;">
                <div style="font-size: 10px; color: #3d2b1f; text-align: right; margin-top: -2px; font-weight: 800;">
                    ZAPAS: ${available}
                </div>
            </div>
        `;
    });
}

window.validatePayment = () => {
    if (!window.currentBuildRequest) return;
    const req = window.currentBuildRequest;

    let isWoodOk = true;
    let isStoneOk = true;
    window.currentPaymentPayload = {};

    // Sprawdzanie Drewna
    if (req.cost.wood > 0) {
        let woodSum = 0;
        document.querySelectorAll('.pay-input-wood').forEach(input => {
            let val = parseInt(input.value) || 0;
            woodSum += val;
            if (val > 0) window.currentPaymentPayload[input.dataset.res] = val;
        });
        const wStatus = document.getElementById('payment-wood-status');
        wStatus.innerText = `${woodSum} / ${req.cost.wood}`;
        wStatus.style.color = woodSum === req.cost.wood ? '#32cd32' : (woodSum > req.cost.wood ? '#ffaa00' : '#ff4444');
        isWoodOk = (woodSum === req.cost.wood);
    }

    // Sprawdzanie Kamienia
    if (req.cost.stone > 0) {
        let stoneSum = 0;
        document.querySelectorAll('.pay-input-stone').forEach(input => {
            let val = parseInt(input.value) || 0;
            stoneSum += val;
            if (val > 0) window.currentPaymentPayload[input.dataset.res] = val;
        });
        const sStatus = document.getElementById('payment-stone-status');
        sStatus.innerText = `${stoneSum} / ${req.cost.stone}`;
        sStatus.style.color = stoneSum === req.cost.stone ? '#32cd32' : (stoneSum > req.cost.stone ? '#ffaa00' : '#ff4444');
        isStoneOk = (stoneSum === req.cost.stone);
    }

    // Fragment wewnątrz window.validatePayment() w buildings.js
    const btn = document.getElementById('payment-confirm-btn');
    if (isWoodOk && isStoneOk && (window.lastPlayerData?.gold || 0) >= req.cost.gold) {
        btn.disabled = false;
        btn.style.opacity = '1'; // Przycisk staje się wyraźny
        btn.style.filter = 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))'; // Dodajemy złoty blask
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5'; // Przycisk jest wyblakły
        btn.style.filter = 'none';
    }
};

window.confirmBuildingPayment = () => {
    const req = window.currentBuildRequest;
    const activeCity = window.currentActiveCityId || currentActiveCityId; // Zabezpieczenie ID Grodu

     window.socket.emit('upgrade_building_request', {
        buildingId: activeCity,
        upgradeType: req.type,
        payment: window.currentPaymentPayload
    });

    document.getElementById('payment-modal').classList.add('hidden-display');
};


// ==========================================
// --- WARSZTAT CIEŚLI (SYSTEM NAPRAW) ---
// ==========================================

// 1. Generowanie listy budynków w bocznym panelu (Wersja zintegrowana z resources.js)
window.renderCarpentersPanel = () => {
    const list = document.getElementById('carpenters-buildings-list');
    if (!list) return;

    const activeCityId = window.currentActiveCityId || currentActiveCityId;
    if (!activeCityId || !window.buildingMarkers[activeCityId]) return;

    const cityMarker = window.buildingMarkers[activeCityId];

    if (!cityMarker.buildingData.buildingHealth) {
        list.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px; font-style:italic;">Brak wzniesionych budowli do nadzoru.</div>';
        return;
    }

    list.innerHTML = '';
    const healthDataMap = cityMarker.buildingData.buildingHealth;

    const bNames = {
        'tavern': 'Karczma', 'market': 'Targowisko', 'blacksmith': 'Kuźnia',
        'barracks': 'Koszary', 'alchemist': 'Chata Alchemika', 'granary': 'Spichlerz',
        'stables': 'Stajnie', 'walls': 'Mury', 'capitol': 'Kapitol', 'farm': 'Farma'
    };

    // Przechodzimy przez każdy wybudowany budynek
    for (const [upgradeKey, healthData] of Object.entries(healthDataMap)) {

        let currentTotal = 0;
        for (const amount of Object.values(healthData.currentMaterials)) {
            currentTotal += (amount || 0);
        }

        const max = healthData.maxDurability || 1;
        const missing = max - currentTotal;

        let actionBtn = '';
        if (missing > 0) {
            actionBtn = `<button onclick="window.openRepairModal('${upgradeKey}', '${bNames[upgradeKey] || upgradeKey}', ${missing})" style="background: #8b0000; color: white; border: 1px solid #ff4444; padding: 4px 10px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 10px; font-weight: bold; border-radius: 3px; text-transform: uppercase; box-shadow: 0 0 5px rgba(255,0,0,0.5);">Odbuduj</button>`;
        } else {
            actionBtn = `<button style="background: #333; color: #777; border: 1px solid #555; padding: 4px 10px; cursor: not-allowed; font-family: 'Cinzel', serif; font-size: 10px; font-weight: bold; border-radius: 3px; text-transform: uppercase;">Bez Skazy</button>`;
        }

        // Generujemy Paski Surowców pobierając dane z GLOBALNEGO słownika resources.js
        let dynamicMaterialsHTML = '';
        for (const [matKey, matAmount] of Object.entries(healthData.currentMaterials)) {
            if (matAmount > 0) {
                // Pobiera styl ze słownika lub ustawia domyślny szary
                const style = window.GAME_RESOURCES.dict[matKey] || { name: matKey, color: '#aaaaaa' };
                const perc = (matAmount / max) * 100;

                dynamicMaterialsHTML += `
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 10px; color: ${style.color}; width: 95px; text-transform: uppercase; font-weight: bold; text-shadow: 1px 1px 0px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${style.name}">${style.name}</span>
                        <div style="flex: 1; height: 8px; background: #111; border: 1px solid #000; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.9);">
                            <div style="height: 100%; background: ${style.color}; width: ${perc}%; transition: width 0.4s;"></div>
                        </div>
                        <span style="font-size: 10px; color: ${style.color}; width: 25px; text-align: right; font-weight: bold; text-shadow: 1px 1px 0px #000;">${matAmount}</span>
                    </div>
                `;
            }
        }

        list.innerHTML += `
            <div class="carpenter-item" style="background: rgba(20, 15, 10, 0.8); border: 1px solid #4a3623; padding: 12px; border-radius: 6px; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <b style="color: #fff; font-size: 14px; text-transform: uppercase;">${bNames[upgradeKey] || upgradeKey}</b>
                    ${actionBtn}
                </div>

                <div style="font-size: 11px; color: #aaa; text-align: right; margin-bottom: 8px; border-bottom: 1px dashed #333; padding-bottom: 5px;">
                    Wytrzymałość: <span style="color: ${missing > 0 ? '#ffaa00' : '#32cd32'}; font-weight: bold;">${currentTotal} / ${max}</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${dynamicMaterialsHTML}
                </div>
            </div>
        `;
    }
};

// 2. Automatyczne odświeżanie panelu Cieśli przy kliknięciu Grodu
const originalOpenCityScreenForCarpenter = window.openCityScreen;
window.openCityScreen = (id) => {
    if (originalOpenCityScreenForCarpenter) originalOpenCityScreenForCarpenter(id);
    window.renderCarpentersPanel(); // Odśwież listę cieśli przy każdym wejściu
};

// 3. Renderowanie suwaków płatności za Naprawę (Wersja zintegrowana)
window.renderRepairSliders = () => {
    if (!window.currentRepairRequest) return;

    const reqAmount = window.currentRepairRequest.missing;
    const playerRes = window.lastPlayerData?.resources || {};
    const container = document.getElementById('repair-wood-inputs');

    // Pobieramy WSZYSTKIE dostępne typy drewna prosto z globalnego pliku resources.js
    const resourceKeys = window.GAME_RESOURCES.categories.wood || [];

    container.innerHTML = ''; // Czyścimy stare suwaki

    resourceKeys.forEach(resKey => {
        const available = playerRes[resKey] || 0;

        // Pobieramy wygląd ze słownika
        const d = window.GAME_RESOURCES.dict[resKey] || { name: resKey, icon: '📦' };

        const sliderMax = Math.min(available, reqAmount);
        const opacity = available > 0 ? '1' : '0.4';
        const pointer = available > 0 ? 'auto' : 'none';

        container.innerHTML += `
            <div style="opacity: ${opacity}; pointer-events: ${pointer}; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                    <span style="font-size: 13px; color: #000; font-weight: 900; text-transform: uppercase; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);">
                        ${d.icon} ${d.name}
                    </span>
                    <b style="color: #8b0000; font-size: 16px; font-weight: 900; text-shadow: 1px 1px 0px rgba(255,255,255,0.5);" id="rep-val-disp-${resKey}">0</b>
                </div>
                <input type="range" class="repair-input-wood"
                    data-res="${resKey}"
                    data-max="${sliderMax}"
                    value="0"
                    min="0" max="${sliderMax}"
                    oninput="window.handleRepairSliderChange(this, ${reqAmount})"
                    style="width: 100%; cursor: pointer; accent-color: #8b0000; height: 10px;">
                <div style="font-size: 10px; color: #3d2b1f; text-align: right; margin-top: -2px; font-weight: 800;">
                    ZAPAS: ${available}
                </div>
            </div>
        `;
    });

    window.validateRepairPayment();
};

// 4. Logika poruszania suwakami (Blokada przekroczenia brakujących punktów)
window.handleRepairSliderChange = (inputEl, reqAmount) => {
    let currentVal = parseInt(inputEl.value) || 0;
    let sumOthers = 0;

    document.querySelectorAll('.repair-input-wood').forEach(input => {
        if (input !== inputEl) sumOthers += (parseInt(input.value) || 0);
    });

    let maxAllowed = reqAmount - sumOthers;
    if (maxAllowed < 0) maxAllowed = 0;
    let actualMax = parseInt(inputEl.dataset.max) || 0;
    maxAllowed = Math.min(maxAllowed, actualMax);

    // Fizycznie cofa suwak, jeśli przeholujesz
    if (currentVal > maxAllowed) {
        inputEl.value = maxAllowed;
        currentVal = maxAllowed;
    }

    const disp = document.getElementById(`rep-val-disp-${inputEl.dataset.res}`);
    if (disp) disp.innerText = currentVal;

    window.validateRepairPayment();
};

// 5. Walidacja przycisku "Zatwierdź Odbudowę"
window.validateRepairPayment = () => {
    if (!window.currentRepairRequest) return;
    const req = window.currentRepairRequest;

    let woodSum = 0;
    window.currentRepairPayload = {};

    document.querySelectorAll('.repair-input-wood').forEach(input => {
        let val = parseInt(input.value) || 0;
        woodSum += val;
        if (val > 0) window.currentRepairPayload[input.dataset.res] = val; // Zapisuje co zadeklarowano
    });

    const statusEl = document.getElementById('repair-wood-status');
    if (statusEl) {
        statusEl.innerText = `${woodSum} / ${req.missing}`;
        // Na zielono jeśli cokolwiek dajesz, na czerwono jak zera
        statusEl.style.color = woodSum > 0 ? '#32cd32' : '#ff4444';
    }

    const btn = document.getElementById('repair-confirm-btn');
    // Pozwalamy naprawiać CZĘŚCIOWO (nie trzeba naprawiać od razu na 100%)
    if (woodSum > 0 && woodSum <= req.missing) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.filter = 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))';
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.filter = 'grayscale(1) brightness(0.6)';
    }
};

// 6. Finalna wysyłka zapytania do serwera
window.confirmBuildingRepair = () => {
    const req = window.currentRepairRequest;
    const activeCity = window.currentActiveCityId || currentActiveCityId;

     window.socket.emit('repair_building_request', {
        buildingId: activeCity,
        upgradeType: req.type,
        payment: window.currentRepairPayload
    });

    document.getElementById('repair-modal').classList.add('hidden-display');
};

// ==========================================
// --- ZAMYKANIE PANELI KLIKNIĘCIEM W TŁO ---
// ==========================================
document.addEventListener('click', (event) => {
    const cityScreen = document.getElementById('city-screen');

    // Zabezpieczenie: skrypt działa tylko, gdy jesteśmy na ekranie Wielkiego Grodu
    if (!cityScreen || cityScreen.classList.contains('hidden-display')) return;

    // Zabezpieczenie: jeśli gracz klika wewnątrz jakiegokolwiek otwartego okna
    // (np. menu Odbudowy, wnętrze Karczmy), ignorujemy kliknięcie, aby nie chować paneli w tle.
    const isInsideModal = event.target.closest('div[id$="-modal"]');
    if (isInsideModal && !isInsideModal.classList.contains('hidden-display')) return;

    // 1. ZAMYKANIE DOLNYCH PANELI (Rozbudowa, Ludność, Kronika)
    const isBottomPanelArea = event.target.closest('.city-slide-panel') || event.target.closest('#city-bottom-nav');

    if (!isBottomPanelArea) {
        document.querySelectorAll('.city-slide-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.city-tab-btn').forEach(b => b.classList.remove('active-tab'));
    }

    // 2. ZAMYKANIE BOCZNEGO WARSZTATU CIEŚLI
    const isCarpenterArea = event.target.closest('#carpenters-panel') || event.target.closest('#carpenters-btn');

    if (!isCarpenterArea) {
        const carpenterPanel = document.getElementById('carpenters-panel');
        if (carpenterPanel) carpenterPanel.classList.remove('active');
    }
});

// ==========================================
// --- EKSPLORACJE I WYPRAWY (PANEL) ---
// ==========================================
window.renderExplorationPanel = () => {
    const player = window.lastPlayerData;
    if (!player) return;

    // 1. PRAWA STRONA: Lokalne Zagrożenia
    const threatsContainer = document.getElementById('local-threats-container');
    if (threatsContainer) {
        // Czytamy zagrożenia z ukrytej, lewej listy (lub z pamięci gracza)
        const threats = player.activeThreats || [];
        if (threats.length === 0) {
            threatsContainer.innerHTML = '<div style="color:#aaa; font-style:italic; text-align:center; margin-top: 20px;">Okolica Grodu jest bezpieczna.</div>';
        } else {
            let html = '';
            threats.forEach(t => {
                html += `
                    <div style="background: rgba(0,0,0,0.6); border: 1px solid #ff4444; border-left: 3px solid #ff4444; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                        <b style="color: #ffaa00; font-size: 13px;">${t.icon || '⚠️'} ${t.name}</b>
                        <p style="font-size: 10px; color: #ccc; margin: 5px 0; font-style: italic;">"${t.desc}"</p>
                        <button onclick="window.sendArmyToThreat('${t.id}')" style="background: #8b0000; color: white; border: 1px solid #ffaa00; width: 100%; padding: 5px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold; margin-top: 5px; text-transform: uppercase;">Wyślij Wojsko</button>
                    </div>
                `;
            });
            threatsContainer.innerHTML = html;
        }
    }

    // 2. LEWA STRONA: Wyprawy (Wybór drużyny)
    const expContainer = document.getElementById('expedition-setup-container');
    if (expContainer) {
        const idleSettlers = (player.settlers || []).filter(s => s.status === 'idle');

        if (idleSettlers.length === 0) {
            expContainer.innerHTML = '<div style="color:#aaa; font-style:italic; text-align:center; margin-top: 20px;">Brak wolnych osadników. Wszyscy są zajęci pracą lub szkoleniem.</div>';
        } else {
            let html = '<div style="max-height: 150px; overflow-y: auto; margin-bottom: 10px; border: 1px solid #333; padding: 5px; background: rgba(0,0,0,0.3);">';
            idleSettlers.forEach(s => {
                let icon = '🧍';
                if (s.profession === 'woodcutter') icon = '🪓';
                else if (s.profession === 'miner') icon = '⛏️';
                else if (s.profession === 'herbalist') icon = '🌿';
                else if (s.profession === 'warrior') icon = '⚔️';
                else if (s.profession === 'hunter') icon = '🏹';

                html += `
                    <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 5px; border-bottom: 1px solid #222; cursor: pointer; border-radius: 3px; margin-bottom: 2px;">
                        <span style="font-size: 12px; color: #ddd;"><input type="checkbox" class="exp-settler-cb" value="${s._id}" style="accent-color: #32cd32;"> ${icon} ${s.name}</span>
                        <span style="font-size: 10px; color: #aaa;">(${s.profession})</span>
                    </label>
                `;
            });
            html += '</div>';
            html += `
                <button onclick="window.startWildExpedition()" style="background: #228b22; color: #000; border: 1px solid #aaddaa; width: 100%; padding: 8px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 12px; font-weight: bold; text-transform: uppercase; box-shadow: inset 0 0 5px rgba(255,255,255,0.3);">
                    Wyrusz w Dzicz (Koszt: 50 💰)
                </button>
            `;
            expContainer.innerHTML = html;
        }
    }
};

window.sendArmyToThreat = (threatId) => {
     window.socket.emit('attack_threat', { threatId: threatId });
};

window.startWildExpedition = () => {
    const checkboxes = document.querySelectorAll('.exp-settler-cb:checked');
    const settlerIds = Array.from(checkboxes).map(cb => cb.value);

    if (settlerIds.length === 0) {
        return window.showNotification("Musisz wybrać kogoś do drużyny!", 'error');
    }

    // Używamy starego endpointu z wypraw
     window.socket.emit('start_expedition_v2', {
        target: "Mroczne Ostępy",
        mission: "gather",
        durationMs: 40000,
        cost: 50,
        settlerIds: settlerIds
    });
};

// ==========================================
// --- KOSZARY: WIDOKI I LOGIKA ---
// ==========================================

window.socket.on('barracks_data', (data) => {
    const content = document.getElementById('barracks-content');
    if (!content) return;

    // Przywracamy główny widok pergaminu (jeśli gracz był na zakładce werbunku)
    content.innerHTML = `
        <h3 style="text-align: center; color: #5a4529; border-bottom: 2px dashed #8b4513; padding-bottom: 10px; margin-top: 0;">ZAAŁOGOWANI WOJOWNICY</h3>
        <div id="barracks-warriors-list" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;"></div>
    `;

    const list = document.getElementById('barracks-warriors-list');
    const warriors = data.warriors || [];

    if (warriors.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: #8b0000; font-weight: bold; margin-top: 20px;">Brak wojowników w Grodzie. Kliknij "Werbunek"!</div>';
        return;
    }

    warriors.forEach(w => {
        const stats = window.getSettlerLevelAndRank(w.exp, w.profession);
        list.innerHTML += `
            <div style="background: rgba(0,0,0,0.05); border: 1px solid #8b4513; border-left: 3px solid #8b0000; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <b style="color: #8b0000; font-size: 15px;">⚔️ ${w.name}</b><br>
                    <span style="font-size: 11px; color: #5a4529;">${stats.rank} (Poz. ${stats.level}) | Dośw: ${w.exp} PD</span>
                </div>
                <div style="font-size: 11px; font-weight: bold; color: ${w.status === 'idle' ? '#32cd32' : '#ff4444'};">
                    ${w.status === 'idle' ? 'Gotowy do walki' : 'Poza Grodem'}
                </div>
            </div>
        `;
    });
});

// Otwiera formularz werbunku, najpierw pytając serwer o ludzi i sprzęt
window.showRecruitmentPanel = () => {
    const content = document.getElementById('barracks-content');
    if (!content) return;

    content.innerHTML = '<div style="text-align:center; padding: 40px; color:#d4af37; font-weight:bold;">Zwoływanie chłopów i otwieranie skrzyń z bronią...</div>';

    // Prosimy serwer o dane
     window.socket.emit('get_draft_candidates');
};

// Serwer odpowiada i renderujemy listy
window.socket.on('draft_candidates_data', (data) => {
    const candidates = data.candidates || [];
    const armory = data.armory || [];
    const content = document.getElementById('barracks-content');
    if (!content) return;

    if (candidates.length === 0) {
        content.innerHTML = `
            <h3 style="text-align: center; color: #8b0000; border-bottom: 2px dashed #8b4513; padding-bottom: 10px; margin-top: 0;">PLAC APELOWY</h3>
            <div style="text-align:center; color: #ff4444; padding: 15px; background: rgba(0,0,0,0.5); border: 1px solid #8b0000;">
                Brak wolnych chłopów do powołania. Wszyscy ciężko pracują lub odpoczywają!
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="window.socket.emit('get_barracks_data')" style="background: none; border: none; color: #5a4529; text-decoration: underline; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold;">Powrót do Listy Wojowników</button>
            </div>
        `;
        return;
    }

    if (armory.length === 0) {
         content.innerHTML = `
            <h3 style="text-align: center; color: #8b0000; border-bottom: 2px dashed #8b4513; padding-bottom: 10px; margin-top: 0;">PLAC APELOWY</h3>
            <div style="text-align:center; color: #ffaa00; padding: 15px; background: rgba(0,0,0,0.5); border: 1px solid #8b4513;">
                Zbrojownia jest pusta! Władyko, każ Kowalowi wykuć unikalny oręż, by mieć w co wyposażyć rekrutów.
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="window.socket.emit('get_barracks_data')" style="background: none; border: none; color: #5a4529; text-decoration: underline; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold;">Powrót do Listy Wojowników</button>
            </div>
         `;
         return;
    }

    let html = `
        <h3 style="text-align: center; color: #8b0000; border-bottom: 2px dashed #8b4513; padding-bottom: 10px; margin-top: 0;">OBOZOWISKO WERBUNKOWE</h3>
        <p style="text-align:center; font-size:11px; color:#5a4529; margin-bottom: 15px;">Wybierz prostego chłopa i podaruj mu mistrzowski oręż. Szkolenie potrwa 1 minutę.</p>

        <div style="background: rgba(0,0,0,0.05); padding: 15px; border: 1px solid #5a4529; border-radius: 4px;">
            <h4 style="color:#8b0000; margin-top:0; border-bottom: 1px dashed #5a4529; padding-bottom: 5px;">1. Kogo powołujesz pod broń?</h4>
            <select id="draft-settler-select" style="width:100%; margin-bottom: 15px; background: #f0e6d2; color: #2b1d0f; padding: 8px; border: 1px solid #8b4513; font-family: 'Cinzel', serif; font-weight: bold; cursor: pointer;">
    `;

    candidates.forEach(c => {
        html += `<option value="${c._id}">🧍 ${c.name} (Chłop - Poziom ${Math.floor(Math.sqrt((c.exp || 0) / 10)) + 1})</option>`;
    });

    html += `
            </select>
            <h4 style="color:#d4af37; margin-top:0; border-bottom: 1px dashed #5a4529; padding-bottom: 5px;">2. Jaki mistrzowski oręż mu powierzysz?</h4>
            <select id="draft-weapon-select" style="width:100%; margin-bottom: 20px; background: #f0e6d2; color: #2b1d0f; padding: 8px; border: 1px solid #8b4513; font-family: 'Cinzel', serif; font-weight: bold; cursor: pointer;">
    `;

    armory.forEach(w => {
        let icon = w.type === 'axe' ? '🪓' : (w.type === 'spear' ? '🔱' : (w.type === 'bow' ? '🏹' : '🗡️'));
        html += `<option value="${w.id}">${icon} ${w.name} (Dmg: ${w.damage})</option>`;
    });

    html += `
            </select>
            <button onclick="window.confirmDraft()" style="width:100%; padding: 12px; background: #8b0000; color: white; border: 1px solid #ff4444; cursor: pointer; text-transform: uppercase; font-weight: bold; font-family: 'Cinzel', serif; transition: 0.2s; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);">
                Wyślij na Plac Treningowy
            </button>
        </div>

        <div style="text-align: center; margin-top: 20px;">
            <button onclick="window.socket.emit('get_barracks_data')" style="background: none; border: none; color: #5a4529; text-decoration: underline; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold;">Anuluj i powróć</button>
        </div>
    `;

    content.innerHTML = html;
});

// Zbieranie danych i wysyłka do serwera
window.confirmDraft = () => {
    const settlerId = document.getElementById('draft-settler-select').value;
    const weaponId = document.getElementById('draft-weapon-select').value;
    if(!settlerId || !weaponId) return;

    window.socket.emit('draft_recruit_request', { settlerId, weaponId });
    document.getElementById('barracks-content').innerHTML = '<div style="text-align:center; color: #32cd32; padding: 40px; font-weight:bold;">Wydawanie rozkazów...</div>';
};