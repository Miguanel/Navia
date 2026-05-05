// Globalna pamięć o rzemiośle
window.craftingRules = null;

window.socket.on('load_crafting_rules', (rules) => {
    window.craftingRules = rules;
    console.log("⚒️ Księga Rzemiosła otwarta w Kuźni.");
    buildCraftingDropdowns(); // Generujemy listy rozwijane!
});

// Funkcja wypełniająca opcje w HTML na podstawie JSONa
function buildCraftingDropdowns() {
    if (!window.craftingRules) return;

    const typeSelect = document.getElementById('bs-item-type');
    const primSelect = document.getElementById('bs-primary-mat');
    const secSelect = document.getElementById('bs-secondary-mat');

    if (!typeSelect || !primSelect || !secSelect) return;

    typeSelect.innerHTML = '';
    for (const [key, data] of Object.entries(window.craftingRules.blueprints)) {
        typeSelect.innerHTML += `<option value="${key}">${data.name}</option>`;
    }

    primSelect.innerHTML = '';
    for (const [key, data] of Object.entries(window.craftingRules.primaryMaterials)) {
        primSelect.innerHTML += `<option value="${key}">${data.prefix} (${data.baseRarity})</option>`;
    }

    secSelect.innerHTML = '';
    for (const [key, data] of Object.entries(window.craftingRules.secondaryMaterials)) {
        secSelect.innerHTML += `<option value="${key}">${data.traitName}</option>`;
    }
}

window.openBlacksmith = function() {
    document.getElementById('blacksmith-modal').classList.remove('hidden-display');
    window.updateBlacksmithUI();
};

window.closeBlacksmith = function() {
    document.getElementById('blacksmith-modal').classList.add('hidden-display');
};

window.updateBlacksmithUI = function() {
    const masterSelect = document.getElementById('bs-master-select');
    const appSelect = document.getElementById('bs-apprentice-select');
    const currentMaster = masterSelect.value;
    const currentApp = appSelect.value;

    masterSelect.innerHTML = '<option value="">-- Przydziel Mistrza --</option>';
    appSelect.innerHTML = '<option value="">-- Wybierz Pomocnika --</option>';

    if (window.mySettlers) {
        window.mySettlers.forEach(s => {
            if (s.status === 'idle' && (s.profession === 'peasant' || s.profession === 'blacksmith')) {
                const nameAndLvl = `${s.name} (${s.profession === 'blacksmith' ? 'Kowal' : 'Chłop'}, PD: ${s.exp})`;

                let opt1 = document.createElement('option');
                opt1.value = s._id; opt1.innerText = nameAndLvl;
                if (s._id === currentMaster) opt1.selected = true;
                masterSelect.appendChild(opt1);

                if (s._id !== currentMaster) {
                    let opt2 = document.createElement('option');
                    opt2.value = s._id; opt2.innerText = nameAndLvl;
                    if (s._id === currentApp) opt2.selected = true;
                    appSelect.appendChild(opt2);
                }
            }
        });
    }

    const masterStats = document.getElementById('bs-master-stats');
    if (currentMaster) {
        const masterData = window.mySettlers.find(s => s._id === currentMaster);
        masterStats.innerText = masterData.profession === 'blacksmith' ? `Mistrz gotowy. Doświadczenie: ${masterData.exp} PD.` : `Zwykły chłop. Uczy się fachu.`;
        masterStats.style.color = masterData.profession === 'blacksmith' ? '#8b0000' : '#8b4513';
    } else {
        masterStats.innerText = "Brak Mistrza. Kuźnia stoi pusta.";
        masterStats.style.color = "#5a4529";
    }

    calculateVisualSuccessChance();
};

function calculateVisualSuccessChance() {
    if (!window.craftingRules) return;

    const masterId = document.getElementById('bs-master-select').value;
    const helperId = document.getElementById('bs-apprentice-select').value;
    const itemType = document.getElementById('bs-item-type').value;
    const primaryMat = document.getElementById('bs-primary-mat').value;
    const secondaryMat = document.getElementById('bs-secondary-mat').value;

    const chanceEl = document.getElementById('bs-success-chance');

    if (!masterId) {
        chanceEl.innerText = "0%";
        chanceEl.style.color = "#5a4529";
        return;
    }

    const blueprint = window.craftingRules.blueprints[itemType];
    const pMat = window.craftingRules.primaryMaterials[primaryMat];
    const sMat = window.craftingRules.secondaryMaterials[secondaryMat];

    if (!blueprint || !pMat || !sMat) return;

    let baseChance = 40;
    baseChance -= blueprint.difficulty;
    baseChance -= pMat.difficulty;
    baseChance -= sMat.difficulty;

    const masterData = window.mySettlers.find(s => s._id === masterId);
    if (masterData) {
        if (masterData.profession === 'blacksmith') baseChance += 30;
        baseChance += Math.floor(masterData.exp / 2);
    }

    if (helperId) {
        const helperData = window.mySettlers.find(s => s._id === helperId);
        if (helperData) {
            baseChance += 15;
            if (helperData.profession === 'blacksmith') baseChance += 10;
        }
    }

    if (baseChance > 95) baseChance = 95;
    if (baseChance < 5) baseChance = 5;

    chanceEl.innerText = `${baseChance}%`;
    chanceEl.style.color = baseChance > 70 ? "#32cd32" : (baseChance > 40 ? "#ffaa00" : "#8b0000");
}

window.forgeItem = function() {
    const masterId = document.getElementById('bs-master-select').value;
    const helperId = document.getElementById('bs-apprentice-select').value;
    const itemType = document.getElementById('bs-item-type').value;
    const primaryMat = document.getElementById('bs-primary-mat').value;
    const secondaryMat = document.getElementById('bs-secondary-mat').value;

    if (!masterId) {
        window.showNotification("Kowadło samo nie uderzy! Przydziel Mistrza.", "error");
        return;
    }

    window.socket.emit('advanced_crafting_request', { masterId, helperId, itemType, primaryMat, secondaryMat });
    window.closeBlacksmith();
};