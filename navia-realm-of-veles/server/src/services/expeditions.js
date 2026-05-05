const Expedition = require('../models/Expedition');
const Player = require('../models/Player');

function startExpeditionLoop(io) {
    setInterval(async () => {
        try {
            const now = new Date();
            const activeExpeditions = await Expedition.find({ status: 'ongoing' });

            for (let exp of activeExpeditions) {
                const endTime = new Date(exp.startTime.getTime() + exp.durationMs);

                if (now >= endTime) {
                    exp.status = 'completed';

                    // ==========================================
                    // --- SYSTEM ZAAWANSOWANYCH ŁUPÓW Z WYPRAW ---
                    // ==========================================
                    let generatedEvents = ['expedition_start', 'exploring', 'expedition_end'];
                    const loot = {}; // Pusty worek na nowe łupy

                    const drwale = exp.crew.woodcutters || 0;
                    const zielarki = exp.crew.herbalists || 0;
                    const woje = exp.crew.warriors || 0;

                    // Obliczamy "moc" zbieracką (im więcej ludzi, tym więcej łupów)
                    const totalYield = (drwale * 20) + (zielarki * 15) + (woje * 10);

                    if (exp.target === 'forest') {
                        // Las daje głównie drewno (różne gatunki) i trochę dziczyzny (food)
                        if (drwale > 0) {
                            loot['wood_birch'] = Math.floor(totalYield * 0.5); // 50% na Brzozę
                            loot['wood_oak'] = Math.floor(totalYield * 0.3);   // 30% na twardy Dąb
                            loot['wood_ash'] = Math.floor(totalYield * 0.2);   // 20% na rzadki Jesion
                        }
                        if (woje > 0) loot['food'] = Math.floor(totalYield * 0.4); // Wojownicy przynoszą mięso
                    }
                    else if (exp.target === 'swamp') {
                        // Mokradła to królestwo ziół i mrocznego drewna
                        if (zielarki > 0) {
                            loot['herb_celandine'] = Math.floor(totalYield * 0.6); // Jaskółcze Ziele
                            loot['herb_wolfsbane'] = Math.floor(totalYield * 0.4); // Wilczy Mlecz
                        }
                        if (drwale > 0) loot['wood_ash'] = Math.floor(totalYield * 0.3); // Zgniły Jesion
                    }
                    else if (exp.target === 'mountains') {
                        // Góry to kamień i ruda
                        if (drwale > 0) { // Traktujemy drwali jako górników (do poprawy w przyszłości)
                            loot['stone'] = totalYield;
                            loot['iron'] = Math.floor(totalYield * 0.3);
                        }
                    }

                    exp.events = generatedEvents;
                    exp.loot = loot; // Zapisujemy nowe, szczegółowe łupy w bazie historii Wyprawy
                    await exp.save();

                    // --- POWRÓT DRUŻYNY, AKTUALIZACJA SKARBCA I DOŚWIADCZENIA ---
                    let playerToUpdate = await Player.findById(exp.playerId);
                    if (playerToUpdate) {

                        // Zapisywanie nowych łupów (Dębów, Ziół itp.)
                        for (let [resName, amount] of Object.entries(loot)) {
                            if (amount > 0) {
                                playerToUpdate.resources[resName] = (playerToUpdate.resources[resName] || 0) + amount;
                            }
                        }

                        // Oddanie "zaangażowania" z panelu
                        playerToUpdate.crew.woodcutters += exp.crew.woodcutters;
                        playerToUpdate.crew.herbalists += exp.crew.herbalists;
                        playerToUpdate.crew.warriors += exp.crew.warriors;

                        // Przywracamy im status "idle" i dodajemy 10 punktów doświadczenia (PD)!
                        playerToUpdate.settlers.forEach(s => {
                            if (exp.settlerIds.includes(s._id.toString())) {
                                s.status = 'idle';
                                s.exp += 10;
                            }
                        });

                        playerToUpdate.markModified('resources');
                        await playerToUpdate.save();

                        // Ostatnie pobranie świeżych danych z bazy
                        const freshPlayer = await Player.findById(exp.playerId);

                        // WYSYŁAMY RAPORT DO MROCZNEGO PERGAMINU NA FRONCIE!
                        io.emit('expedition_returned', {
                            story: `Wyprawa dobiegła końca! Twoi ludzie (${exp.settlerIds.length} dusz) wrócili cali i zdrowi, niosąc dary ze szlaku.`,
                            loot: loot
                        });

                        // Odświeżamy HUD Władyki
                        io.emit('treasury_updated', { gold: freshPlayer.gold, resources: freshPlayer.resources, crew: freshPlayer.crew, settlers: freshPlayer.settlers, houses: freshPlayer.houses });
                    }
                }
            }
        } catch (err) { console.error("❌ Błąd w silniku wypraw:", err); }
    }, 5000); // Sprawdza co 5 sekund
}

module.exports = startExpeditionLoop;