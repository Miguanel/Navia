const Building = require('../models/Building'); // Podłączamy model budynków do silnika czasu

// Cykl rozkładu drewna (1 cykl = 1 in-game godzina)
const decayCycle = [
    { woodType: 'wood_birch', amountToRemove: 10 },
    { woodType: 'wood_ash',   amountToRemove: 2 },
    { woodType: 'wood_oak',   amountToRemove: 1 }
];

// Pamięć silnika (żeby nie psuć budynków co 2 sekundy, tylko równo co godzinę w grze)
let lastProcessedInGameHour = -1;

// Asynchroniczna funkcja pożerająca budynki
async function triggerBuildingDecay(io) {
    try {
        const cities = await Building.find({ type: 'city' });

        for (let city of cities) {
            let cityChanged = false;
            if (!city.buildingHealth) continue;

            // Sprawdzamy stan każdego wybudowanego budynku w Grodzie
            for (let [upgradeKey, healthData] of city.buildingHealth.entries()) {
                let cycleLength = decayCycle.length;
                let foundMaterial = false;

                // Szukamy surowca do usunięcia w tej godzinie
                for (let i = 0; i < cycleLength; i++) {
                    let currentIndex = (healthData.currentDecayStep + i) % cycleLength;
                    let step = decayCycle[currentIndex];
                    let currentAmount = healthData.currentMaterials[step.woodType] || 0;

                    if (currentAmount > 0) {
                        healthData.currentMaterials[step.woodType] = Math.max(0, currentAmount - step.amountToRemove);
                        healthData.currentDecayStep = (currentIndex + 1) % cycleLength;
                        foundMaterial = true;
                        cityChanged = true;
                        break;
                    }
                }

                // Bezpieczne sprawdzenie, czy w budynku została jeszcze JAKAKOLWIEK deska
                let currentTotal =
                    (healthData.currentMaterials.wood_birch || 0) +
                    (healthData.currentMaterials.wood_ash || 0) +
                    (healthData.currentMaterials.wood_oak || 0);

                // Budynek się zawala!
                if (currentTotal <= 0 && healthData.maxDurability > 0) {
                    console.log(`[RUINA] Władyko! Budowla '${upgradeKey}' obróciła się w pył!`);

                    // Usuwamy budynek z listy i ze słownika zdrowia
                    city.upgrades = city.upgrades.filter(u => u !== upgradeKey);
                    city.buildingHealth.delete(upgradeKey);
                    cityChanged = true;

                    io.emit('error_msg', `Z powodu zepsucia zawalił się budynek: ${upgradeKey}!`);
                }
            }

            if (cityChanged) {
                // Konieczne wymuszenie zapisu dla specjalnych typów Mongoose (Map i Array)
                city.markModified('buildingHealth');
                city.markModified('upgrades');
                await city.save();
                io.emit('building_updated', city); // Aktualizuje mapę i UI u wszystkich graczy
            }
        }
    } catch (err) {
        console.error("❌ Błąd silnika rozkładu w timeEngine:", err);
    }
}

// Silnik Czasu Absolutnego (Deterministyczny)
function startTimeLoop(io) {
    const EPOCH_MS = 1704067200000; // 1 Stycznia 2024
    const IN_GAME_DAY_MS = 12 * 60 * 60 * 1000; // 12 realnych godzin
    const seasons = ['Wiosna', 'Lato', 'Jesień', 'Zima'];

    const updateTime = () => {
        try {
            const now = Date.now();
            const elapsedMs = Math.max(0, now - EPOCH_MS);

            const totalInGameDays = Math.floor(elapsedMs / IN_GAME_DAY_MS);
            const dayOfSeason = (totalInGameDays % 14) + 1;
            const seasonIndex = Math.floor(totalInGameDays / 14) % 4;
            const currentSeason = seasons[seasonIndex];
            const year = Math.floor(totalInGameDays / 56) + 1;

            const msIntoCurrentDay = elapsedMs % IN_GAME_DAY_MS;
            const inGameHourFloat = (msIntoCurrentDay / IN_GAME_DAY_MS) * 24;
            const inGameHours = Math.floor(inGameHourFloat);
            const inGameMinutes = Math.floor((inGameHourFloat - inGameHours) * 60);

            let sunrise = 6, sunset = 18;
            if (currentSeason === 'Lato') { sunrise = 4; sunset = 20; }
            if (currentSeason === 'Zima') { sunrise = 8; sunset = 16; }

            const isDaylight = inGameHourFloat >= sunrise && inGameHourFloat < sunset;
            const formattedTime = `${inGameHours.toString().padStart(2, '0')}:${inGameMinutes.toString().padStart(2, '0')}`;

            // --- NOWOŚĆ: INTEGRACJA Z ROZKŁADEM BUDYNKÓW ---
            // Jeśli zegar wybił nową in-game godzinę (np. zmienił się z 14 na 15)
            if (lastProcessedInGameHour !== -1 && inGameHours !== lastProcessedInGameHour) {
                triggerBuildingDecay(io); // Odpalamy rdzę!
            }
            lastProcessedInGameHour = inGameHours; // Zapisujemy obecną godzinę
            // -------------------------------------------------

            io.emit('time_updated', {
                year: year,
                season: currentSeason,
                day: dayOfSeason,
                time: formattedTime,
                isDaylight: isDaylight
            });

        } catch (error) {
            console.error("❌ Błąd silnika czasu:", error);
        }
    };

    updateTime(); // Wywołaj natychmiast przy starcie serwera!
    setInterval(updateTime, 2000); // Odświeżaj co 2 sekundy, by zegar płynnie tykał
}

module.exports = startTimeLoop;