

// ==========================================
// --- GPS, MAPA I PRĘDKOŚCIOMIERZ ---
// ==========================================
let lastPosTime = Date.now();
let lastPosCoords = null;
let devModeActive = false;
let devLat = 49.972, devLng = 18.388;
const devStep = 0.0004; // Krok ok. 40-50 metrów

function updatePlayerPosition(lat, lng) {
    // 1. Aktualizacja Markera i Widoku
    if (!window.playerMarker) window.playerMarker = L.marker([lat, lng]).addTo(window.map).bindPopup("<b>Awatar Władycy</b>");
    else window.playerMarker.setLatLng([lat, lng]);

    if (!window.domainCircle) window.domainCircle = L.circle([lat, lng], { color: '#8b0000', fillColor: '#4a0000', fillOpacity: 0.1, radius: 1000 }).addTo(window.map);
    else window.domainCircle.setLatLng([lat, lng]);

    window.map.setView([lat, lng]);

    // 2. Obliczanie Prędkości
    const now = Date.now();
    const dt = (now - lastPosTime) / 1000; // czas w sekundach

    if (lastPosCoords && dt > 0.2) {
        const dist = window.map.distance(lastPosCoords, [lat, lng]); // dystans w metrach
        const speedKmh = (dist / dt) * 3.6;

        const speedEl = document.getElementById('speed-value');
        if (speedEl) {
            speedEl.innerText = speedKmh.toFixed(1);
            // Kolory: Zielony (chód), Pomarańcz (bieg), Czerwony (pojazd/dev)
            speedEl.style.color = speedKmh > 25 ? '#ff4444' : (speedKmh > 6 ? '#ffaa00' : '#32cd32');
        }
    }
    lastPosCoords = [lat, lng];
    lastPosTime = now;
}

// Obsługa prawdziwego GPS
window.map.locate({setView: true, maxZoom: 16, watch: true});
window.map.on('locationfound', (e) => {
    if (!devModeActive) {
        updatePlayerPosition(e.latlng.lat, e.latlng.lng);
        // BEZPIECZNE WYWOŁANIE: Sprawdzamy, czy plik terrain.js zdążył się wczytać
        if (typeof window.loadRealTerrain === 'function') {
            window.loadRealTerrain(e.latlng.lat, e.latlng.lng);
        } else {
            console.warn("⏳ Zwoje terenu jeszcze się ładują, czekam...");
        }
    }
});

// ==========================================
// --- LOGIKA STEROWANIA DEWELOPERSKIEGO ---
// ==========================================
function movePlayerDev(latOff, lngOff) {
    if (!devModeActive) {
        devModeActive = true;
        window.map.stopLocate(); // Wyłączamy prawdziwy GPS
        if (window.playerMarker) {
            devLat = window.playerMarker.getLatLng().lat;
            devLng = window.playerMarker.getLatLng().lng;
        }
        window.showNotification("Aktywowano Tryb Ducha (Manualny GPS)", "error");
    }

    devLat += latOff;
    devLng += lngOff;

    updatePlayerPosition(devLat, devLng);
    if (typeof window.loadRealTerrain === 'function') window.loadRealTerrain(devLat, devLng);
}

// Podpięcie przycisków po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dev-up').onclick = () => movePlayerDev(devStep, 0);
    document.getElementById('dev-down').onclick = () => movePlayerDev(-devStep, 0);
    document.getElementById('dev-left').onclick = () => movePlayerDev(0, -devStep);
    document.getElementById('dev-right').onclick = () => movePlayerDev(0, devStep);

    document.getElementById('dev-center').onclick = () => {
        devModeActive = false;
        window.map.locate({setView: true, maxZoom: 16, watch: true});
        window.showNotification("Powrót do prawdziwej lokalizacji", "success");
    };
});

// ==========================================
// --- SYSTEM PŁYWAJĄCYCH POWIADOMIEŃ I DZIENNIKA ---
// ==========================================

window.showNotification = (msg, type = 'info') => {
    // 1. WYSWIETLANIE DYMKU NA EKRANIE
    const container = document.getElementById('toast-container');
    if (container) {
        const toast = document.createElement('div');
        toast.className = `toast-msg toast-${type}`;

        let icon = '📜';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span style="margin-right: 10px; font-size: 16px;">${icon}</span> ${msg}`;
        container.appendChild(toast);

        // Zniknięcie po 5 sekundach
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 5000);
    }

    // 2. ZAPIS DO DZIENNIKA W RATUSZU
    // Pobieramy aktualną godzinę
    const time = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Dodajemy wpis na sam początek listy (najnowsze na górze)
    window.gameLogs.unshift({ time: time, msg: msg, type: type });

    // Ograniczamy pamięć do 50 ostatnich zdarzeń, by nie zapchać przeglądarki
    if (window.gameLogs.length > 50) {
        window.gameLogs.pop();
    }

    // Odświeżamy widok dziennika, jeśli gracz akurat ma go otwartego
    window.renderGameLogs();
};

// Funkcja rysująca wpisy w zakładce Ratusza
window.renderGameLogs = () => {
    const list = document.getElementById('city-log-list');
    if (!list) return;

    list.innerHTML = '';

    if (window.gameLogs.length === 0) {
        list.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px; font-style: italic;">Dziennik jest pusty. W Grodzie panuje spokój.</div>';
        return;
    }

    window.gameLogs.forEach(log => {
        let borderColor = '#4682b4'; // domyślny niebieskawy (info)
        let textColor = '#ddd';

        if (log.type === 'success') {
            borderColor = '#32cd32';
            textColor = '#aaddaa';
        } else if (log.type === 'error') {
            borderColor = '#8b0000';
            textColor = '#ff9999';
        }

        list.innerHTML += `
            <div style="background: rgba(0,0,0,0.6); border-left: 3px solid ${borderColor}; padding: 8px 12px; font-size: 12px; border-radius: 3px; font-family: 'Cinzel', serif;">
                <span style="color: #888; font-size: 10px; margin-right: 8px;">[${log.time}]</span>
                <span style="color: ${textColor};">${log.msg}</span>
            </div>
        `;
    });
};

// ==========================================
// --- TEREN I GEOGRAFIA (OVERPASS API + CACHE) ---
// ==========================================
window.map.on('locationfound', (e) => {
    updatePlayerPosition(e.latlng.lat, e.latlng.lng);
    loadRealTerrain(e.latlng.lat, e.latlng.lng);
});

// ==========================================
// --- SYNCHRONIZACJA Z SERWEREM ---
// ==========================================
window.socket.on('building_placed', (b) => drawBuildingOnMap(b));
// Globalna pamięć o budynkach
window.allBuildings = [];
window.mainCityData = null;

// Ładowanie wszystkich budynków przy starcie
window.socket.on('load_buildings', (list) => {
    window.allBuildings = list;

    // Szukamy Głównego Grodu
    const city = list.find(b => b.type === 'city');
    if (city) {
        window.mainCityData = city;
        if (typeof window.updateCityVisuals === 'function') window.updateCityVisuals();
    }

    // Rysujemy na mapie
    list.forEach(b => drawBuildingOnMap(b));
});
window.socket.on('npc_spawned', (n) => drawNpcOnMap(n));
window.socket.on('load_npcs', (list) => list.forEach(n => drawNpcOnMap(n)));

window.socket.on('action_success', (msg) => window.showNotification(msg, 'success'));
window.socket.on('error_msg', (msg) => window.showNotification(msg, 'error'));


window.socket.on('treasury_updated', (data) => {
     window.lastPlayerData = data;
    // --- BEZPIECZNY ZAPIS PAMIĘCI ---
    if (data.settlers !== undefined) window.mySettlers = data.settlers;
    if (data.houses !== undefined) window.myHouses = data.houses;

    // --- OBLICZANIE LIMITÓW POPULACJI ---
    const cityMarker = Object.values(window.buildingMarkers).find(m => m.buildingData && m.buildingData.type === 'city');
    let maxPop = 5 + (window.myHouses * 5);
    if (cityMarker && cityMarker.buildingData.upgrades.includes('walls')) maxPop += 15;
    const currentPop = window.mySettlers.length;

    // Aktualizacja wskaźników UI
    if (document.getElementById('th-houses-count')) document.getElementById('th-houses-count').innerText = window.myHouses;
    if (document.getElementById('th-pop-limit')) document.getElementById('th-pop-limit').innerText = `${currentPop} / ${maxPop}`;
    if (document.getElementById('barracks-free-slots')) {
        const free = Math.max(0, maxPop - currentPop);
        document.getElementById('barracks-free-slots').innerText = free;
        document.getElementById('barracks-free-slots').style.color = free > 0 ? '#32cd32' : '#ff4444';
    }

    if (!document.getElementById('building-screen').classList.contains('hidden-display')) {
        if(typeof renderBuildingPersonnel === 'function') renderBuildingPersonnel();
    }

    // --- Aktualizacja Głównego Magazynu i HUD ---
    if (document.getElementById('res-gold')) document.getElementById('res-gold').innerText = Math.floor(data.gold || 0);
    if (data.resources) {
        const res = data.resources;
        // Obliczamy sumy dla głównego paska:
        const totalWood = (res.wood_birch || 0) + (res.wood_oak || 0) + (res.wood_ash || 0);
        const totalHerbs = (res.herb_celandine || 0) + (res.herb_wolfsbane || 0);
        const totalWeapons = (res.wpn_sword || 0) + (res.wpn_axe || 0) + (res.wpn_bow || 0) + (res.wpn_spear || 0);

        if (document.getElementById('res-wood')) document.getElementById('res-wood').innerText = totalWood;
        if (document.getElementById('res-stone')) document.getElementById('res-stone').innerText = Math.floor(res.stone || 0);
        if (document.getElementById('res-herbs')) document.getElementById('res-herbs').innerText = totalHerbs;
        if (document.getElementById('res-weapons')) document.getElementById('res-weapons').innerText = totalWeapons;
    }

    // --- Renderowanie Księgi Ludności w Ratuszu ---
    if (document.getElementById('population-list')) {
        const container = document.getElementById('population-list');
        container.innerHTML = '';

        if (window.mySettlers.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; font-style: italic; padding: 20px;">Twój Gród świeci pustkami. Zwerbuj poddanych w Koszarach!</div>';
        } else {
            const sortedSettlers = [...window.mySettlers].sort((a, b) => a.profession.localeCompare(b.profession));

            sortedSettlers.forEach(s => {
                let icon = '🧍'; let profName = 'Chłop'; let color = '#888';
                if (s.profession === 'woodcutter') { icon = '🪓'; profName = 'Drwal'; color = '#aaddaa'; }
                else if (s.profession === 'miner') { icon = '⛏️'; profName = 'Górnik'; color = '#aaa'; }
                else if (s.profession === 'herbalist') { icon = '🌿'; profName = 'Zielarka'; color = '#32cd32'; }
                else if (s.profession === 'warrior') { icon = '⚔️'; profName = 'Woj'; color = '#ff6666'; }

                let statusColor = '#4682b4';
                let statusText = 'Gotowy do zadań';
                if (s.status === 'expedition') { statusColor = '#ffaa00'; statusText = 'Wyruszył w dzicz'; }
                if (s.status === 'working') { statusColor = '#32cd32'; statusText = 'Ciężko pracuje'; }
                if (s.status === 'walking_to_work') { statusColor = '#aaa'; statusText = '🚶 Zmierza do pracy'; }
                if (s.status === 'returning_home') { statusColor = '#aaa'; statusText = '🚶 Wraca do Grodu'; }
                if (s.status === 'resting') { statusColor = '#555'; statusText = '🛌 Odpoczywa'; }

                container.innerHTML += `
                    <div style="background: #222; border: 1px solid ${color}; border-radius: 5px; padding: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div>
                            <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
                            <b style="color: #fff; font-size: 15px;">${s.name}</b> <span style="color: #aaa; font-size: 12px;">(${profName})</span>
                            <div style="font-size: 12px; color: #d4af37; margin-top: 4px;">Cechy: ${s.trait} | Doświadczenie: ${s.exp} PD</div>
                        </div>
                        <div style="font-size: 11px; padding: 5px 10px; background: rgba(0,0,0,0.5); border: 1px solid ${statusColor}; color: ${statusColor}; border-radius: 3px; font-weight: bold;">
                            ${statusText}
                        </div>
                    </div>
                `;
            });
        }
    }
    // ==========================================
    // --- ZAAWANSOWANY SYSTEM SUROWCÓW (HUD) ---
    // ==========================================
    window.updateAdvancedHUD = (playerData) => {
        const res = playerData.resources || {};

        const goldEl = document.getElementById('res-gold-advanced');
        if (goldEl) goldEl.innerText = Math.floor(playerData.gold || 0);

        // NOWE: Żywność i Skóry
        const foodEl = document.getElementById('cat-food-total');
        if (foodEl) foodEl.innerText = res.food || 0;

        const peltsEl = document.getElementById('cat-pelts-total');
        if (peltsEl) peltsEl.innerText = res.pelts || 0;

        // DREWNO
        const wBirch = res.wood_birch || 0; const wOak = res.wood_oak || 0; const wAsh = res.wood_ash || 0;
        const woodEl = document.getElementById('cat-wood-total');
        if (woodEl) {
            woodEl.innerText = wBirch + wOak + wAsh;
            document.getElementById('res-wood-birch').innerText = wBirch;
            document.getElementById('res-wood-oak').innerText = wOak;
            document.getElementById('res-wood-ash').innerText = wAsh;
        }

        // ZIOŁA
        const hCel = res.herb_celandine || 0; const hWolf = res.herb_wolfsbane || 0;
        const herbsEl = document.getElementById('cat-herbs-total');
        if (herbsEl) {
            herbsEl.innerText = hCel + hWolf;
            document.getElementById('res-herb-celandine').innerText = hCel;
            document.getElementById('res-herb-wolfsbane').innerText = hWolf;
        }

        // UZBROJENIE (Teraz połączone z Tarczami!)
        const wSword = res.wpn_sword || 0; const wAxe = res.wpn_axe || 0;
        const wBow = res.wpn_bow || 0; const wSpear = res.wpn_spear || 0;
        const sWood = res.shd_wood || 0; const sIron = res.shd_iron || 0;
        const wpnEl = document.getElementById('cat-weapons-total');
        if (wpnEl) {
            wpnEl.innerText = wSword + wAxe + wBow + wSpear + sWood + sIron;
            document.getElementById('res-wpn-sword').innerText = wSword;
            document.getElementById('res-wpn-axe').innerText = wAxe;
            document.getElementById('res-wpn-bow').innerText = wBow;
            document.getElementById('res-wpn-spear').innerText = wSpear;
            document.getElementById('res-shd-wood').innerText = sWood;
            document.getElementById('res-shd-iron').innerText = sIron;
        }

        // MIKSTURY
        const pHeal = res.pot_heal || 0; const pPoison = res.pot_poison || 0;
        const potEl = document.getElementById('cat-potions-total');
        if (potEl) {
            potEl.innerText = pHeal + pPoison;
            document.getElementById('res-pot-heal').innerText = pHeal;
            document.getElementById('res-pot-poison').innerText = pPoison;
        }

        // KRUSZCE
        const sStone = res.stone || 0; const oreIron = res.iron || 0;
        const oresEl = document.getElementById('cat-ores-total');
        if (oresEl) {
            oresEl.innerText = sStone + oreIron;
            document.getElementById('res-stone-adv').innerText = sStone;
            document.getElementById('res-iron-adv').innerText = oreIron;
        }
    };

    // !!! KLUCZOWE: URUCHOMIENIE FUNKCJI !!!
    // Wywołujemy ją za każdym razem, gdy serwer prześle nowe dane o skarbcu:
    window.updateAdvancedHUD(data);

});

// Aktualizacja listy zagrożeń (np. Zmary)
window.socket.on('active_threats_updated', (threats) => {
    window.activeThreats = threats; // Zapisujemy do globalnej pamięci dla logistics.js
    updateMapCurseEffects(threats);
    // Jeśli masz już funkcję odświeżającą listę w panelu bocznym:
    if (typeof updateThreatsUI === 'function') {
        updateThreatsUI(threats);
    }
});
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

    if (total === 0) container.innerHTML = '<span style="color:#aaa;">Magazyn jest pusty</span>';
};

// ==========================================
// --- SYNCHRONIZACJA WYGLĄDU (LIVE UPDATE) ---
// ==========================================

window.socket.on('building_upgraded', (bData) => {
    window.drawBuildingOnMap(bData);

    // NOWOŚĆ: Jeśli zaktualizowano Główny Gród, odświeżamy jego wnętrze!
    if (bData.type === 'city') {
        window.mainCityData = bData;
        console.log("🛠️ Gród rozbudowany! Aktualizacja widoku...");
        if (typeof window.updateCityVisuals === 'function') window.updateCityVisuals();
    }

    // NAPRAWA: Zawsze wymuszamy odczyt poprawnego ID miasta z obiektu window!
    // Zakładamy, że currentActiveCityId może być zmienną globalną bez window.
    const activeCityId = window.currentActiveCityId || (typeof currentActiveCityId !== 'undefined' ? currentActiveCityId : null);

    if (activeCityId === bData._id) {
        if (bData.type === 'city') {
            if (typeof window.openCityScreen === 'function') window.openCityScreen(bData._id);
        }
        else if (typeof window.openBuildingScreen === 'function') window.openBuildingScreen(bData._id);
    }
});

window.socket.on('building_updated', (bData) => {
    window.drawBuildingOnMap(bData);

    const activeCityId = window.currentActiveCityId || currentActiveCityId;

    if (activeCityId === bData._id) {
        // Aktualizacja magazynów w Placówkach
        if (!document.getElementById('building-screen').classList.contains('hidden-display')) {
            if (typeof window.updateBuildingStorageUI === 'function') window.updateBuildingStorageUI(bData);
        }

        // NOWOŚĆ: Live Update dla Warsztatu Cieśli (odświeżanie paska na żywo!)
        if (typeof window.renderCarpentersPanel === 'function') {
            window.renderCarpentersPanel();
        }
    }
});
// ==========================================
// --- WIZUALNE EFEKTY KLĄTWY NA MAPIE ---
// ==========================================
function updateMapCurseEffects(activeThreats = []) {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    // Sprawdzamy, czy Zmara jest aktywna
    const isWraithActive = activeThreats.some(t => t.id === 'wraith_threat_1');

    if (isWraithActive) {
        // Jeśli Zmara żyje -> dodajemy mroczną aurę
        mapElement.classList.add('wraith-curse');
        console.log("🌑 Mrok spowił krainę... Zmara nadchodzi.");
    } else {
        // Jeśli Zmara została pokonana -> usuwamy efekt
        mapElement.classList.remove('wraith-curse');
        console.log("✨ Mrok ustąpił, klątwa została zdjęta.");
    }
}
window.destroyBuilding = (id) => { if (confirm("Zburzyć budynek?")) socket.emit('destroy_request', { buildingId: id }); };
window.socket.on('building_destroyed', (data) => { if (window.buildingMarkers[data.buildingId]) { window.map.removeLayer(window.buildingMarkers[data.buildingId]); delete window.buildingMarkers[data.buildingId]; } });
window.socket.on('npc_destroyed', (data) => { if (window.npcMarkers[data.npcId]) { clearInterval(window.npcMarkers[data.npcId].moveInterval); window.map.removeLayer(window.npcMarkers[data.npcId]); delete window.npcMarkers[data.npcId]; } });

// --- ZARZĄDZANIE WIDOCZNOŚCIĄ PANELU DEBUG ---
window.toggleDebugPanel = function() {
    const debugPanel = document.getElementById('debug-controls');
    const toggleBtn = document.getElementById('debug-toggle-btn');

    if (debugPanel) {
        debugPanel.classList.toggle('hidden-display');

        // Opcjonalnie: zmiana koloru przycisku, gdy debug jest włączony
        if (!debugPanel.classList.contains('hidden-display')) {
            toggleBtn.style.background = "#8b0000"; // Ciemna czerwień
            toggleBtn.style.borderColor = "#ff4444";
        } else {
            toggleBtn.style.background = "rgba(0,0,0,0.7)";
            toggleBtn.style.borderColor = "#ffaa00";
        }
    }
};
window.toggleScoutPanel = function() {
    const scoutPanel = document.getElementById('scout-panel');
    if (scoutPanel) {
        scoutPanel.classList.toggle('hidden-display');
    }
};

// ==========================================
// --- SYNCHRONIZACJA WIZUALNA GRODU ---
// ==========================================
window.updateCityVisuals = function() {
    if (!window.mainCityData) return;

    // Pobieramy listę wzniesionych ulepszeń z bazy (np. ['tavern', 'blacksmith'])
    const upgrades = window.mainCityData.upgrades || [];

    // Lista wszystkich możliwych budynków wewnątrz Grodu
    const innerBuildings = [
        'tavern', 'market', 'blacksmith', 'barracks',
        'alchemist', 'granary', 'stables', 'walls', 'capitol', 'farm'
    ];

    innerBuildings.forEach(bType => {
        const sprite = document.getElementById(`sprite-${bType}`);
        const btn = document.getElementById(`btn-${bType}`);

        if (upgrades.includes(bType)) {
            // 1. BUDYNEK ISTNIEJE -> Pokazujemy go na grafice tła!
            if (sprite) {
                sprite.style.display = 'block';
                sprite.style.pointerEvents = 'auto'; // Pozwala na kliknięcie w budynek
            }

            // 2. Aktualizujemy przycisk w dolnym menu (zakładka "Rozbudowa")
            if (btn) {
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none'; // Blokujemy ponowne kliknięcie
                btn.style.borderColor = '#32cd32'; // Zielona ramka

                // Zachowujemy stary tytuł przycisku
                const title = btn.querySelector('b') ? btn.querySelector('b').innerText : bType;
                btn.innerHTML = `<b>${title}</b><br><span style="font-size:10px; color:#32cd32; font-weight:bold;">Wzniesiony</span>`;
            }
        } else {
            // BUDYNEK JESZCZE NIE ISTNIEJE -> Ukrywamy grafikę
            if (sprite) {
                sprite.style.display = 'none';
                sprite.style.pointerEvents = 'none';
            }
        }
    });
};