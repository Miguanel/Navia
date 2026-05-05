// ==========================================
// --- BUDOWANIE (MAKRO) ---
// ==========================================
let buildMode = false;
let selectedBuildingType = null;

// Otwieranie i zamykanie menu
window.openBuildMenu = () => {
    document.getElementById('build-menu').classList.add('active');
    // Wymuszamy wygenerowanie kafelków po otwarciu
    if (typeof renderBuildMenu === 'function') {
        renderBuildMenu();
    }
};

window.closeBuildMenu = () => {
    document.getElementById('build-menu').classList.remove('active');
};

// Aktywacja i deaktywacja trybu stawiania na mapie
window.selectBuilding = (type) => {
    selectedBuildingType = type;
    buildMode = true;
    window.closeBuildMenu();
    document.getElementById('build-mode-indicator').classList.remove('hidden-display');
};

window.cancelBuildMode = () => {
    buildMode = false;
    selectedBuildingType = null;
    document.getElementById('build-mode-indicator').classList.add('hidden-display');
};

// ==========================================
// --- DANE ARCHITEKTONICZNE Z SERWERA ---
// ==========================================
window.buildingRules = {};

window.socket.on('load_building_rules', (rules) => {
    window.buildingRules = rules;
    console.log("📜 Otrzymano architektoniczne plany Grodu ze Skarbca.");
    renderBuildMenu();
});

// ==========================================
// --- GENEROWANIE KAFELKÓW (UI) ---
// ==========================================
function renderBuildMenu() {
    const container = document.querySelector('#build-menu .build-options');
    if (!container) return;

    container.innerHTML = ''; // Czyszczenie starych danych

    const terrainColors = {
        'forest': { name: 'Las', bg: '#006400', color: '#fff' },
        'water': { name: 'Woda', bg: '#4682b4', color: '#fff' },
        'swamp': { name: 'Mokradła', bg: '#2f4f4f', color: '#fff' },
        'rock': { name: 'Skały', bg: '#555555', color: '#fff' },
        'mountains': { name: 'Góry', bg: '#555555', color: '#fff' },
        'meadow': { name: 'Łąka', bg: '#9acd32', color: '#000' },
        'grassland': { name: 'Trawa', bg: '#9acd32', color: '#000' },
        'any': { name: 'Dowolny Teren', bg: '#222', color: '#d4af37', border: '1px solid #d4af37' }
    };

    for (const [type, data] of Object.entries(window.buildingRules)) {

        // 1. Etykiety Kosztów
        let costHtml = '';
        if (data.cost) {
            if (data.cost.gold) costHtml += `<span class="cost-badge gold">${data.cost.gold} 💰</span>`;

            let woodTotal = (data.cost.wood_birch || 0) + (data.cost.wood_oak || 0) + (data.cost.wood_ash || 0);
            if (woodTotal > 0) costHtml += `<span class="cost-badge wood">${woodTotal} 🌲</span>`;

            if (data.cost.stone) costHtml += `<span class="cost-badge stone">${data.cost.stone} ⛏️</span>`;
        }

        // 2. Etykiety Terenów
        let terrainHtml = '';
        const reqTerrains = data.allowedTerrain || ['any'];

        reqTerrains.forEach(t => {
            const tc = terrainColors[t] || terrainColors['any'];
            const borderStyle = tc.border ? `border: ${tc.border};` : '';
            terrainHtml += `<span class="terrain-badge" style="background: ${tc.bg}; color: ${tc.color}; ${borderStyle}">${tc.name}</span>`;
        });

        // 3. Budowa karty HTML
        const card = document.createElement('div');
        card.className = 'build-card';
        card.onclick = () => window.selectBuilding(type);

        card.innerHTML = `
            <img src="${data.icon || 'https://placehold.co/64x64/333/FFF?text=?'}"
                 alt="${data.name}"
                 class="build-icon"
                 onerror="this.src='https://placehold.co/64x64/333/FFF?text=?'">
            <h3>${data.name}</h3>
            <div class="card-terrain">${terrainHtml}</div>
            <div class="card-cost">${costHtml}</div>
        `;

        container.appendChild(card);
    }
}

// ==========================================
// --- STAWIANIE BUDYNKÓW NA MAPIE ---
// ==========================================
window.map.on('click', (e) => {
    if (!buildMode || !selectedBuildingType) return;

    const clickPt = turf.point([e.latlng.lng, e.latlng.lat]);
    const bData = window.buildingRules[selectedBuildingType];
    const reqTerrains = (bData && bData.allowedTerrain) ? bData.allowedTerrain : ['any'];

    let isValidLocation = (reqTerrains.includes('any'));
    let terrainFound = false;

    const checkGeoJSON = (geojsonData) => {
        if (!geojsonData) return false;
        let found = false;
        turf.featureEach(geojsonData, (feature) => {
            if (turf.booleanPointInPolygon(clickPt, feature)) found = true;
        });
        return found;
    };

    // Walidacja ukształtowania terenu
    if (!isValidLocation) {
        if (reqTerrains.includes('forest') && checkGeoJSON(window.gameTerrain.forestsGeoJSON)) terrainFound = true;

        if (reqTerrains.includes('water') && window.gameTerrain.waterGeoJSON) {
            turf.featureEach(window.gameTerrain.waterGeoJSON, (feature) => {
                const dist = turf.pointToLineDistance(clickPt, feature, {units: 'meters'});
                if (dist <= 50) terrainFound = true;
            });
        }

        if (reqTerrains.includes('rock') && checkGeoJSON(window.gameTerrain.otherGeoJSON)) terrainFound = true;

        isValidLocation = terrainFound;
    }

    if (!isValidLocation) {
        let errDesc = reqTerrains.join(" lub ");
        return alert(`❌ Ten budynek wymaga specyficznego terenu: ${errDesc.toUpperCase()}!`);
    }

    // Wysłanie rozkazu budowy do serwera
    window.socket.emit('build_request', {
        type: selectedBuildingType,
        lat: e.latlng.lat,
        lng: e.latlng.lng
    });

    window.cancelBuildMode();
});