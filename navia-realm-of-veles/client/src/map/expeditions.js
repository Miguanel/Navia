// ==========================================
// --- INTERFEJS PLANOWANIA WYPRAWY ---
// ==========================================
window.mySettlers = [];

window.openExpeditionPlanner = () => {
    const list = document.getElementById('exp-crew-list');
    list.innerHTML = '';

    // Szukamy tylko tych, którzy siedzą bezczynnie w Grodzie
    const idleSettlers = window.mySettlers.filter(s => s.status === 'idle');

    if (idleSettlers.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: center; padding: 10px; font-size: 12px;">Brak wolnych poddanych. Zwerbuj kogoś w Koszarach!</div>';
    } else {
        // Renderujemy każdego jako pole Checkbox
        idleSettlers.forEach(s => {
            let icon = '🧍';
            if (s.profession === 'woodcutter') icon = '🪓';
            else if (s.profession === 'miner') icon = '⛏️';
            else if (s.profession === 'herbalist') icon = '🌿';
            else if (s.profession === 'warrior') icon = '⚔️';
            list.innerHTML += `
                <label style="display: flex; align-items: center; gap: 10px; background: #222; padding: 5px; border: 1px solid #444; cursor: pointer; border-radius: 3px; transition: 0.2s;">
                    <input type="checkbox" class="exp-settler-cb" value="${s._id}" data-prof="${s.profession}" onchange="updateExpectedLoot()">
                    <span style="font-size: 14px;">${icon} <b>${s.name}</b> <span style="font-size: 10px; color: #aaa;">(${s.trait} | ${s.exp} PD)</span></span>
                </label>
            `;
        });
    }

    document.getElementById('plan-expedition-modal').classList.remove('hidden-display');
    updateExpectedLoot();
};

window.updateExpectedLoot = () => {
    const timeMins = parseInt(document.getElementById('exp-duration').value);
    document.getElementById('exp-time-label').innerText = `${timeMins} min`;

    // Liczymy zaznaczone checkboxy!
    const checkboxes = document.querySelectorAll('.exp-settler-cb:checked');
    let drwale = 0, zielarki = 0, woje = 0, chlopi = 0, gornicy = 0;

    checkboxes.forEach(cb => {
        if (cb.dataset.prof === 'woodcutter') drwale++;
        if (cb.dataset.prof === 'herbalist') zielarki++;
        if (cb.dataset.prof === 'warrior') woje++;
        if (cb.dataset.prof === 'peasant') chlopi++;
        if (cb.dataset.prof === 'miner') gornicy++;
    });

    document.getElementById('exp-crew-summary').innerHTML = `Wybrano: <b style="color:#fff">${drwale}</b> Drwali | <b style="color:#fff">${zielarki}</b> Zielarek | <b style="color:#fff">${woje}</b> Wojów | <b style="color:#fff">${chlopi}</b> Chłopów`;

    let totalCrew = drwale + zielarki + woje + chlopi + gornicy;
    if (totalCrew === 0) {
        document.getElementById('exp-prediction').innerHTML = "<span style='color:red;'>Zaznacz kogoś do drużyny!</span>";
        document.getElementById('exp-cost').innerText = "Koszt prowiantu: 0 💰";
        return;
    }

    // Matematyka predykcyjna (bez zmian)
    let minWood = 0, maxWood = 0, minGold = 0, maxGold = 0;
    const target = document.getElementById('exp-target').value;
    const mission = document.getElementById('exp-mission').value;

    if (target === 'forest') { minWood = drwale * 10 * timeMins; maxWood = drwale * 25 * timeMins; minGold = (zielarki * 5 + woje * 2) * timeMins; maxGold = (zielarki * 15 + woje * 8) * timeMins; }
    else if (target === 'swamp') { minWood = drwale * 2 * timeMins; maxWood = drwale * 5 * timeMins; minGold = (zielarki * 15 + woje * 5) * timeMins; maxGold = (zielarki * 40 + woje * 15) * timeMins; }
    else { minWood = 0; maxWood = 0; minGold = (woje * 10 + drwale * 5) * timeMins; maxGold = (woje * 25 + drwale * 10) * timeMins; }

    let riskLevel = "Średnie";
    if (mission === 'scout') { maxWood *= 0.5; maxGold *= 0.5; riskLevel = "<span style='color:green;'>Niskie</span>"; }
    if (mission === 'hunt') { maxGold *= 1.5; riskLevel = "<span style='color:red;'>Wysokie</span>"; }

    let predictionText = "";
    if (maxWood > 0) predictionText += `🪵 ~${minWood} do ${Math.floor(maxWood)} Drewna<br>`;
    if (maxGold > 0) predictionText += `💰 ~${minGold} do ${Math.floor(maxGold)} Wartości Łupów<br>`;
    predictionText += `<br>Ryzyko: <b>${riskLevel}</b>`;

    document.getElementById('exp-prediction').innerHTML = predictionText;

    const cost = (totalCrew * 5) + (timeMins * 10);
    document.getElementById('exp-cost').innerText = `Koszt prowiantu: ${cost} 💰`;
    window.currentExpeditionCost = cost;
};

window.confirmAndSendExpedition = () => {
    // Zbieramy ID zaznaczonych osadników
    const checkboxes = document.querySelectorAll('.exp-settler-cb:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length === 0) return alert("Nie możesz wysłać pustej drużyny!");

    const timeMins = parseInt(document.getElementById('exp-duration').value);
    const target = document.getElementById('exp-target').value;
    const mission = document.getElementById('exp-mission').value;

    document.getElementById('plan-expedition-modal').classList.add('hidden-display');

    window.socket.emit('start_expedition_v2', {
        target: target,
        mission: mission,
        durationMs: timeMins * 60000,
        cost: window.currentExpeditionCost,
        settlerIds: selectedIds // WYSYŁAMY KONKRETNE ID DO SERWERA!
    });
};
// ==========================================
// --- SŁOWIAŃSKA KSIĘGA PUSZCZY (Lore) ---
// ==========================================
let SlavicLore = { dictionary: {}, events: {} };

async function loadSlavicLore() {
    try {
        const response = await fetch('data/slavicLore.json');
        if (!response.ok) throw new Error('Nie udało się załadować księgi.');
        SlavicLore = await response.json();
        console.log("📜 Słowiańska Księga Puszczy załadowana.");
    } catch (error) {
        console.error("❌ Błąd ładowania Lore:", error);
    }
}

loadSlavicLore();

function getLoreText(eventTag) {
    const texts = SlavicLore.events[eventTag];
    if (!texts || texts.length === 0) return `[Zdarzenie: ${eventTag}]`;
    return texts[Math.floor(Math.random() * texts.length)];
}

window.socket.on('expedition_started', (data) => {
    window.showNotification(data.message, 'info');
});

// ==========================================
// --- ODBIÓR RAPORTU Z WYPRAWY ---
// ==========================================
window.socket.on('expedition_finished', (data) => {
    // 1. Zapisujemy w dzienniku powiadomienie ogólne
    window.showNotification("Zwiadowcy powrócili do Grodu!", "success");

    // 2. Budujemy tekst opowieści
    let storyHtml = data.storyText.map(sentence => {
        if (sentence.includes("Walka") || sentence.includes("Porażka") || sentence.includes("ranami")) {
            return `<p style="color: #ff6666; font-weight: bold; margin: 5px 0;">⚔️ ${sentence}</p>`;
        }
        return `<p style="color: #aaddaa; margin: 5px 0;">🌿 ${sentence}</p>`;
    }).join('');

    // 3. Budujemy kafelki z łupami
    let lootHtml = "";
    if (data.loot && Object.keys(data.loot).length > 0) {
        lootHtml = '<h4 style="color:#d4af37; border-bottom: 1px solid #5a4529; padding-bottom: 5px; margin-top: 15px;">Zdobyte Dobra:</h4><div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">';

        for (let [resKey, amount] of Object.entries(data.loot)) {
            if (amount > 0) {
                // Tłumaczenie kodów na ładne nazwy (możesz użyć swojego GAME_RESOURCES jeśli masz)
                let resName = resKey; let icon = '📦'; let color = '#fff';
                if(resKey === 'wood_birch') { resName = 'Brzoza'; icon = '🌲'; color = '#aaddaa'; }
                if(resKey === 'herb_celandine') { resName = 'Jaskółcze Ziele'; icon = '🌿'; color = '#32cd32'; }
                if(resKey === 'food') { resName = 'Zapasy'; icon = '🍖'; color = '#ffaa00'; }
                if(resKey === 'gold') { resName = 'Złoto'; icon = '🪙'; color = '#ffd700'; }
                if(resKey === 'pelts') { resName = 'Skóry'; icon = '🦡'; color = '#8b4513'; }
                if(resKey === 'stone') { resName = 'Kamień'; icon = '🪨'; color = '#aaa'; }

                lootHtml += `
                    <div style="background: rgba(0,0,0,0.6); border: 1px solid ${color}; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        <span style="color: ${color};">${icon} ${resName}:</span> <span style="color: #32cd32;">+${amount}</span>
                    </div>
                `;
            }
        }
        lootHtml += '</div>';
    } else {
        lootHtml = '<div style="margin-top: 15px; text-align: center; color: #888; font-style: italic;">Sakwy są puste. Wrócili z niczym.</div>';
    }

    // 4. Renderowanie mrocznego pergaminu
    const modalHtml = `
        <div id="expedition-report-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 6000; background: linear-gradient(to bottom, #1a1510, #0a0805); border: 3px solid #5a4529; padding: 20px; color: white; width: 350px; border-radius: 10px; box-shadow: 0 0 50px rgba(0,0,0,0.9);">
            <h3 style="color: #d4af37; font-family: 'Cinzel', serif; margin-top: 0; text-align: center;">📜 Raport Zwiadowców</h3>

            <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 5px; border: 1px inset #333;">
                ${storyHtml}
            </div>

            ${lootHtml}

            <button onclick="this.parentElement.remove()" style="margin-top: 20px; width: 100%; padding: 12px; background: #5a4529; color: white; font-weight: bold; border: 1px solid #d4af37; cursor: pointer; border-radius: 4px; font-family: 'Cinzel', serif;">Czytaj i Zapamiętaj</button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
});

// ==========================================
// --- WIELKA KSIĘGA TERENU (LORE & EVENTS) ---
// ==========================================
window.TerrainLore = null;

// Funkcja pobierająca zwoje z pliku
async function loadTerrainLore() {
    try {
        const response = await fetch('data/terrainLore.json'); // Pamiętaj o dobrej ścieżce (np. samo 'terrainLore.json' jeśli są w tym samym folderze co index.html)
        if (!response.ok) throw new Error('Nie udało się załadować zwojów terenu.');
        window.TerrainLore = await response.json();
        console.log("📜 Wielka Księga Terenu otwarta!");
    } catch (error) {
        console.error("❌ Błąd ładowania Księgi:", error);
    }
}
// Uruchamiamy pobieranie od razu przy starcie skryptu
loadTerrainLore();

window.getSlavicDescription = function(type, area, tags) {
    if (!window.TerrainLore) return "Nieznane ziemie (Księga niedostępna).";
    const lore = window.TerrainLore.descriptions;
    const size = area ? Math.round(area) : 0;

    // Specjalne opisy dla konkretnych miejsc
    if (tags.historic === 'tomb' && lore.special.tomb) return lore.special.tomb;
    if (tags.natural === 'spring' && lore.special.spring) return lore.special.spring;
    if (tags.natural === 'stone' && lore.special.stone) return lore.special.stone;

    // Zwykłe opisy zależne od wielkości
    const category = lore[type] || [{ max: 999999999, text: lore.default }];
    const foundDesc = category.find(d => size <= d.max);

    return foundDesc ? foundDesc.text : lore.default;
}

window.getEventChances = function(type, isMagicNearby) {
    if (!window.TerrainLore) return [];

    // Kopiujemy bazowe szanse z JSONa, aby ich trwale nie zmodyfikować
    const baseList = window.TerrainLore.events[type] || [];
    let events = baseList.map(e => ({...e}));

    // Modyfikatory aury magicznej
    if (isMagicNearby) {
        const mods = window.TerrainLore.magic_modifiers;

        // Zmniejszamy szansę na zwykłe, nie-magiczne/nie-bojowe eventy
        events.forEach(e => {
            if(e.id !== 'magic' && !e.id.includes('combat')) {
                e.chance = Math.max(mods.minChance, e.chance - mods.suppression);
            }
        });

        // Dodajemy potężne magiczne zagrożenie
        if (mods.extraEvent) {
            events.push({...mods.extraEvent});
        }
    }

    return events;
}

// ==========================================
// --- PANEL WYPRAWY I DRUŻYNY ---
// ==========================================

window.showTerrainModal = (title, desc, baseEvents, latlng, type) => {
    // 1. Zbieramy tylko ludzi gotowych do drogi z Grodu (ze statusem 'idle')
    const availableSettlers = window.mySettlers ? window.mySettlers.filter(s => s.status === 'idle') : [];

    // 2. Usuwamy stare okno, jeśli było otwarte
    const modalId = 'terrain-expedition-modal';
    const old = document.getElementById(modalId);
    if(old) old.remove();

    // 3. Budujemy listę osadników
    let settlersHtml = '<div style="color: #ff4444; font-size: 11px; text-align:center;">Brak wolnych ludzi w Grodzie! Wszyscy pracują lub odpoczywają.</div>';

    if (availableSettlers.length > 0) {
        settlersHtml = availableSettlers.map(s => {
            let icon = '🧍'; let color = '#aaa';
            if(s.profession === 'warrior') { icon = '⚔️'; color = '#ff6666'; }
            if(s.profession === 'herbalist') { icon = '🌿'; color = '#32cd32'; }
            if(s.profession === 'woodcutter') { icon = '🪓'; color = '#d4af37'; }

            return `
                <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.5); padding: 5px; margin-bottom: 3px; border: 1px solid ${color}; border-radius: 4px; cursor: pointer;">
                    <span style="font-size: 12px; color: #ddd;">
                        <input type="checkbox" class="expedition-checkbox" value="${s._id}" data-prof="${s.profession}">
                        ${icon} ${s.name} <span style="font-size: 10px; color: ${color};">(${s.profession})</span>
                    </span>
                    <span style="font-size: 10px; color: #888;">Poz: ${Math.floor((s.exp||0)/10)+1}</span>
                </label>
            `;
        }).join('');
    }

    // 4. Składamy to w wielki interfejs HTML
    const modalHtml = `
        <div id="${modalId}" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5000; background: linear-gradient(to bottom, rgba(30,20,15,0.95), rgba(15,10,5,0.98)); border: 3px solid #d4af37; padding: 20px; color: white; width: 320px; border-radius: 10px; box-shadow: 0 0 30px rgba(0,0,0,0.8);">
            <h3 style="color: #d4af37; font-family: 'Cinzel', serif; margin-top: 0; text-align: center; border-bottom: 1px dashed #5a4529; padding-bottom: 5px;">${title}</h3>
            <p style="font-style: italic; color: #aaa; font-size: 12px; text-align: center; margin-bottom: 15px;">"${desc}"</p>

            <h4 style="font-size: 13px; margin: 0 0 5px 0; color: #ddd;">Kogo poślesz w nieznane? (Max 3)</h4>
            <div id="expedition-roster" style="max-height: 120px; overflow-y: auto; margin-bottom: 15px; scrollbar-width: thin; scrollbar-color: #5a4529 transparent;">
                ${settlersHtml}
            </div>

            <h4 style="font-size: 13px; margin: 0 0 5px 0; color: #ddd;">Przewidywania Zwiadowców:</h4>
            <div id="expedition-chances" style="font-size: 12px; background: rgba(0,0,0,0.6); padding: 10px; border-radius: 5px; border: 1px inset #5a4529;">
                </div>

            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="this.parentElement.parentElement.remove()" style="flex: 1; padding: 10px; background: #333; color: white; border: 1px solid #555; cursor: pointer; border-radius: 4px;">Zaniechaj</button>
                <button id="btn-start-expedition" style="flex: 2; padding: 10px; background: #8b0000; color: white; font-weight: bold; border: 1px solid #ff4444; cursor: pointer; border-radius: 4px; box-shadow: inset 0 0 10px rgba(0,0,0,0.5);" disabled>Wyruszcie w Drogę</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 5. Logika przeliczania na żywo
    const checkboxes = document.querySelectorAll('.expedition-checkbox');
    const chancesContainer = document.getElementById('expedition-chances');
    const btnStart = document.getElementById('btn-start-expedition');

    const updateChances = () => {
        let selectedCount = 0;
        let gatherBonus = 0;
        let combatBonus = 0;
        const selectedIds = [];

        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedCount++;
                selectedIds.push(cb.value);
                const prof = cb.getAttribute('data-prof');
                if (prof === 'herbalist' || prof === 'woodcutter') gatherBonus += 30;
                if (prof === 'warrior') combatBonus += 50;
            }
        });

        checkboxes.forEach(cb => {
            if (!cb.checked) cb.disabled = (selectedCount >= 3);
        });

        btnStart.disabled = (selectedCount === 0);
        btnStart.style.opacity = (selectedCount === 0) ? "0.5" : "1";

        let html = '';
        baseEvents.forEach(e => {
            let finalChance = e.chance;
            let finalWinChance = e.winChance;
            let color = e.magic ? '#ffd700' : '#ccc';

            if (e.id.includes('gather') && selectedCount > 0) finalChance = Math.min(100, finalChance + gatherBonus);
            if (e.id.includes('combat') && selectedCount > 0) finalWinChance = Math.min(100, finalWinChance + combatBonus);

            html += `
                <div style="margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 2px;">
                    <div style="display: flex; justify-content: space-between; color: ${color};">
                        <span>${e.name}</span>
                        <span>${finalChance}%</span>
                    </div>
            `;
            if (e.id.includes('combat')) {
                let winColor = finalWinChance > 50 ? '#32cd32' : '#ff4444';
                html += `<div style="text-align: right; font-size: 10px; color: ${winColor};">Szansa na przetrwanie: ${finalWinChance}%</div>`;
            }
            html += `</div>`;
        });

        if(selectedCount === 0) html = '<div style="color:#888; text-align:center;">Wybierz śmiałków, by poznać rokowania.</div>' + html;
        chancesContainer.innerHTML = html;
    };

    checkboxes.forEach(cb => cb.addEventListener('change', updateChances));
    updateChances();

    // 6. WYSYŁKA ZWIADU NA SERWER
    btnStart.addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.expedition-checkbox:checked')).map(cb => cb.value);
        if (selectedIds.length === 0) return;

        // Sprawdzamy czy to Miejsce Mocy
        const isMagic = checkMagicProximity(latlng);

        // Komunikat do serwera (server.js)
        window.socket.emit('start_expedition', {
            terrainType: type,
            isMagicNearby: isMagic,
            settlerIds: selectedIds,
            durationMs: 15000
        });

        if(typeof window.showNotification === 'function') {
            window.showNotification("Drużyna wyruszyła w dzicz! Czekaj na wieści...", "info");
        } else {
            console.log("Drużyna wyruszyła w dzicz!");
        }

        document.getElementById(modalId).remove();
    });
};