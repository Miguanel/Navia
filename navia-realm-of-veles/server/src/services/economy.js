const Building = require('../models/Building');
const NPC = require('../models/Npc');
const Player = require('../models/Player');

function startEconomyLoop(io) {
    setInterval(async () => {
        try {
            console.log("⏳ [Gospodarka] Praca w Grodzie i na szlakach trwa...");

            let player = await Player.findOne();
            if (!player) return;

            const cities = await Building.find({ type: 'city' });
            const caravans = await NPC.find({ role: 'caravan' });
            const mainCity = cities[0];

            // 1. PRODUKCJA OPARTA NA NAUCE I AWANSACH
            const productionSites = await Building.find({ type: { $in: ['sawmill', 'mine', 'shrine', 'herbalist_hut', 'hunter_hut', 'fields'] } });

            const bulkOps = []; // Przechowuje awanse i PD do jednorazowego zapisu

            for (let b of productionSites) {
                let maxCap = b.storage.maxCapacity || 100;
                if (b.upgrades.includes('heavy_carts')) maxCap += 100;
                if (mainCity && mainCity.upgrades.includes('edict_logistics')) maxCap += 200; // <-- DEKRET LOGISTYKI

                // --- DEKLARACJE ZMIENNYCH PRODUKCJI ---
                let woodProd = 0; let stoneProd = 0; let herbsProd = 0;
                let foodProd = 0; let peltsProd = 0; // <--- DODANO BRAKUJĄCE ZMIENNE!
                let isWorking = false;

                player.settlers.forEach(s => {
                    if (s.status === 'working' && s.workplaceId === b._id.toString()) {
                        isWorking = true;

                        let baseBonus = 0;
                        if (s.trait && s.trait.includes('Krzepki')) baseBonus += 2;
                        if (s.trait && s.trait.includes('Pijak')) baseBonus -= 2;
                        if (mainCity && mainCity.upgrades.includes('edict_labor')) baseBonus += 2; // <-- DEKRET PRACY
                        let expBonus = Math.floor((s.exp || 0) / 20);

                        // TARTAK
                        if (b.type === 'sawmill' && (s.profession === 'woodcutter' || s.profession === 'peasant')) {
                            if (s.profession === 'peasant') {
                                woodProd += Math.max(1, 2.5 + baseBonus + expBonus); // Praktykant: 2.5/cykl = 10/min
                                if ((s.exp || 0) + 5 >= 50) {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $set: { "settlers.$.profession": "woodcutter", "settlers.$.exp": 50 } } } });
                                    io.emit('action_success', `${s.name} nauczył się fachu i został Drwalem!`);
                                } else {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 5 } } } });
                                }
                            } else {
                                woodProd += Math.max(1, 5 + baseBonus + expBonus); // Mistrz (Drwal): 5/cykl = 20/min
                                bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 2 } } } });
                            }
                        }

                        // KOPALNIA
                        if (b.type === 'mine' && (s.profession === 'miner' || s.profession === 'peasant')) {
                            if (s.profession === 'peasant') {
                                stoneProd += Math.max(1, 2.5 + baseBonus + expBonus); // Praktykant: 2.5/cykl = 10/min
                                if ((s.exp || 0) + 5 >= 50) {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $set: { "settlers.$.profession": "miner", "settlers.$.exp": 50 } } } });
                                    io.emit('action_success', `${s.name} obudził w sobie żyłę Górnika!`);
                                } else {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 5 } } } });
                                }
                            } else {
                                stoneProd += Math.max(1, 5 + baseBonus + expBonus); // Mistrz (Górnik): 5/cykl = 20/min
                                bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 2 } } } });
                            }
                        }
                        // --- CHATA ZIELARKI ---
                        if (b.type === 'herbalist_hut' && (s.profession === 'herbalist' || s.profession === 'peasant')) {
                            if (s.profession === 'peasant') {
                                herbsProd += Math.max(1, 2.5 + baseBonus + expBonus); // Praktykant
                                if ((s.exp || 0) + 5 >= 50) {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $set: { "settlers.$.profession": "herbalist", "settlers.$.exp": 50 } } } });
                                    io.emit('action_success', `${s.name} pojmuje sekrety natury i zostaje Zielarzem!`);
                                } else {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 5 } } } });
                                }
                            } else {
                                herbsProd += Math.max(1, 5 + baseBonus + expBonus); // Mistrz (Zielarz)
                                bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 2 } } } });
                            }
                        }

                        // --- CHATA MYŚLIWEGO ---
                        if (b.type === 'hunter_hut' && s.workplaceId === b._id.toString() && s.status === 'working') {
                            if (s.profession === 'peasant') { foodProd += 2; peltsProd += 1; }
                            if (s.profession === 'hunter') { foodProd += 5; peltsProd += 2; }

                            // Awanse myśliwych
                            if (s.profession === 'peasant') {
                                if ((s.exp || 0) + 5 >= 50) {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $set: { "settlers.$.profession": "hunter", "settlers.$.exp": 50 } } } });
                                } else {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 5 } } } });
                                }
                            } else {
                                bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 2 } } } });
                            }

                            isWorking = true; // ZEZWALAMY NA ODKŁADANIE DO MAGAZYNU!
                        }

                        // --- POLA UPRAWNE (Wymagają wozu) ---
                        if (b.type === 'fields' && s.workplaceId === b._id.toString() && s.status === 'working') {
                            if (s.profession === 'peasant') { foodProd += 3; }
                            if (s.profession === 'farmer') { foodProd += 8; }

                            // Awanse rolników
                            if (s.profession === 'peasant') {
                                if ((s.exp || 0) + 5 >= 50) {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $set: { "settlers.$.profession": "farmer", "settlers.$.exp": 50 } } } });
                                } else {
                                    bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 5 } } } });
                                }
                            } else {
                                bulkOps.push({ updateOne: { filter: { _id: player._id, "settlers._id": s._id }, update: { $inc: { "settlers.$.exp": 2 } } } });
                            }

                            isWorking = true; // Flaga dla magazynu i woza
                        }
                    }
                });

                // Fizyczne zapełnianie magazynu
                if (isWorking) {
                    if (b.type === 'sawmill' && woodProd > 0) {
                        if (b.upgrades.includes('sharp_axes')) woodProd += 8;
                        let currentTotal = (b.storage.wood_birch || 0) + (b.storage.wood_oak || 0) + (b.storage.wood_ash || 0);
                        let space = Math.max(0, maxCap - currentTotal);
                        let actual = Math.min(space, woodProd);
                        if (actual > 0) {
                            b.storage.wood_birch = (b.storage.wood_birch || 0) + Math.floor(actual * 0.5);
                            b.storage.wood_oak = (b.storage.wood_oak || 0) + Math.floor(actual * 0.3);
                            b.storage.wood_ash = (b.storage.wood_ash || 0) + (actual - Math.floor(actual * 0.5) - Math.floor(actual * 0.3));
                        }

                    } else if (b.type === 'mine' && stoneProd > 0) {
                        if (b.upgrades.includes('deep_shaft')) stoneProd += 5;
                        let currentTotal = (b.storage.stone || 0) + (b.storage.iron || 0);
                        let space = Math.max(0, maxCap - currentTotal);
                        let actual = Math.min(space, stoneProd);
                        if (actual > 0) {
                            // Górnicy wydobywają 80% kamienia i 20% żelaza
                            b.storage.stone = (b.storage.stone || 0) + Math.floor(actual * 0.8);
                            b.storage.iron = (b.storage.iron || 0) + Math.ceil(actual * 0.2);
                        }

                    } else if (b.type === 'herbalist_hut' && herbsProd > 0) {
                        let hCap = 100;
                        if (b.upgrades.includes('drying_racks')) hCap += 100;
                        if (b.upgrades.includes('sharp_sickles')) herbsProd += 5;
                        let currentTotal = (b.storage.herb_celandine || 0) + (b.storage.herb_wolfsbane || 0);
                        let space = Math.max(0, hCap - currentTotal);
                        let actual = Math.min(space, herbsProd);
                        if (actual > 0) {
                            b.storage.herb_celandine = (b.storage.herb_celandine || 0) + Math.floor(actual * 0.6);
                            b.storage.herb_wolfsbane = (b.storage.herb_wolfsbane || 0) + (actual - Math.floor(actual * 0.6));
                        }
                    } else if (b.type === 'fields' && foodProd > 0) {
                        let currentTotal = b.storage.food || 0;
                        let space = Math.max(0, maxCap - currentTotal);
                        let actual = Math.min(space, foodProd);
                        if (actual > 0) {
                            b.storage.food = (b.storage.food || 0) + actual;
                        }
                    } else if (b.type === 'hunter_hut' && (foodProd > 0 || peltsProd > 0)) {
                        let currentTotal = (b.storage.food || 0) + (b.storage.pelts || 0);
                        let space = Math.max(0, maxCap - currentTotal);
                        let actualFood = Math.min(space, foodProd);
                        let actualPelts = Math.min(Math.max(0, space - actualFood), peltsProd);
                        if (actualFood > 0 || actualPelts > 0) {
                            b.storage.food = (b.storage.food || 0) + actualFood;
                            b.storage.pelts = (b.storage.pelts || 0) + actualPelts;
                        }
                    }else if (b.type === 'shrine' && b.upgrades.includes('blessing_wealth')) {
                        await Player.updateOne({ _id: player._id }, { $inc: { gold: 5 } });
                    }
                    await b.save();
                    io.emit('building_updated', b);
                }
            }

            // Bezpieczny, masowy zapis zdobytego doświadczenia!
            if (bulkOps.length > 0) {
                await Player.bulkWrite(bulkOps);
                const p = await Player.findById(player._id);
                io.emit('treasury_updated', { gold: p.gold, resources: p.resources, crew: p.crew, settlers: p.settlers });
            }

            // 2. BONUSY Z WEWNĘTRZNYCH BUDYNKÓW W GRODZIE
            let cityIncome = 0;
            for (let city of cities) {
                if (city.upgrades.includes('tavern')) cityIncome += 10;
                if (city.upgrades.includes('edict_taxes')) cityIncome += 20; // <-- DEKRET: +20 Złota!
            }
            if (cityIncome > 0) {
                await Player.updateOne({ _id: player._id }, { $inc: { gold: cityIncome } });
            }

            // 3. ZAAWANSOWANA LOGISTYKA KARAWAN (Dystans i Prędkość)
            let claimedTargets = [];

            // Funkcja pomocnicza: Obliczanie odległości między dwoma punktami GPS
            const getDistance = (loc1, loc2) => Math.sqrt(Math.pow(loc1.lat - loc2.lat, 2) + Math.pow(loc1.lng - loc2.lng, 2));

            for (let caravan of caravans) {
                if (!mainCity) break;

                // Zmienione zapytanie - szukamy konkretnych gatunków oraz POMIJAmy chaty myśliwych
                const needsPickup = await Building.find({
                    _id: { $nin: claimedTargets },
                    $or: [
                        { 'storage.wood_birch': { $gt: 0 } }, { 'storage.wood_oak': { $gt: 0 } }, { 'storage.wood_ash': { $gt: 0 } },
                        { 'storage.stone': { $gt: 0 } }, { 'storage.iron': { $gt: 0 } },
                        { 'storage.herb_celandine': { $gt: 0 } }, { 'storage.herb_wolfsbane': { $gt: 0 } },
                        { 'storage.food': { $gt: 0 } },
                        { 'storage.pelts': { $gt: 0 } } // Widzi skóry!
                    ],
                    type: { $ne: 'city' } // Miasto odpada, reszta zostaje
                });

                if (needsPickup.length > 0) {
                    needsPickup.sort((a, b) => {
                        let sumA = (a.storage.wood || 0) + (a.storage.stone || 0) + (a.storage.herbs || 0);
                        let sumB = (b.storage.wood || 0) + (b.storage.stone || 0) + (b.storage.herbs || 0);
                        return sumB - sumA;
                    });

                    const targetBuilding = needsPickup[0];
                    claimedTargets.push(targetBuilding._id);

                    // --- OBLICZANIE CZASU PODRÓŻY ---
                    const dist = getDistance(mainCity.location, targetBuilding.location);

                    // Stała prędkość: dystans 0.01 GPS pokonywany jest w ok. 10 sekund (10000 ms)
                    let travelTimeMs = Math.floor(dist * 1000000);

                    // EFEKT STAJNI: Konie z Grodu przyspieszają wozy o 100% (czas podróży dzieli się na 2)
                    if (mainCity.upgrades.includes('stables')) {
                        travelTimeMs = Math.floor(travelTimeMs / 2);
                    }

                    // Zabezpieczenia: minimum 2 sekundy dla budynków obok siebie, maksimum 60 sekund na kraniec mapy
                    if (travelTimeMs < 2000) travelTimeMs = 2000;
                    if (travelTimeMs > 60000) travelTimeMs = 60000;

                    // 1. Karawana wyrusza, a serwer wysyła jej wyliczony czas!
                    io.emit('npc_activity', {
                        npcId: caravan._id,
                        action: 'collecting',
                        target: targetBuilding.location,
                        home: caravan.location,
                        duration: travelTimeMs
                    });

                    // Odbiór i powrót
                    setTimeout(async () => {
                        const source = await Building.findById(targetBuilding._id);
                        if (!source) return;

                        const wBirch = source.storage.wood_birch || 0;
                        const wOak = source.storage.wood_oak || 0;
                        const wAsh = source.storage.wood_ash || 0;
                        const stoneToTake = source.storage.stone || 0;
                        const ironToTake = source.storage.iron || 0;
                        const hCel = source.storage.herb_celandine || 0;
                        const hWolf = source.storage.herb_wolfsbane || 0;

                        // Pobieramy nowe zasoby!
                        const fToTake = source.storage.food || 0;
                        const pToTake = source.storage.pelts || 0;

                        // Zerujemy magazyn
                        source.storage.wood_birch = 0; source.storage.wood_oak = 0; source.storage.wood_ash = 0;
                        source.storage.stone = 0; source.storage.iron = 0;
                        source.storage.herb_celandine = 0; source.storage.herb_wolfsbane = 0;
                        source.storage.food = 0;
                        source.storage.pelts = 0; // Zerujemy skóry

                        await source.save();
                        io.emit('building_updated', source);

                        io.emit('npc_activity', {
                            npcId: caravan._id, action: 'delivering',
                            target: mainCity.location, home: source.location, duration: travelTimeMs
                        });

                        setTimeout(async () => {
                            await Player.updateOne(
                                { _id: player._id },
                                { $inc: {
                                    'resources.wood_birch': wBirch,
                                    'resources.wood_oak': wOak,
                                    'resources.wood_ash': wAsh,
                                    'resources.stone': stoneToTake,
                                    'resources.iron': ironToTake,
                                    'resources.herb_celandine': hCel,
                                    'resources.herb_wolfsbane': hWolf,
                                    'resources.food': fToTake,
                                    'resources.pelts': pToTake // Wóz oddaje skóry do Gracza
                                } }
                            );

                            const updatedPlayer = await Player.findById(player._id);
                            if (updatedPlayer) {
                                io.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers, houses: updatedPlayer.houses });
                            }
                        }, travelTimeMs);
                    }, travelTimeMs);
                }
            }

            // Wysyłamy stan skarbca na koniec cyklu
            const freshPlayer = await Player.findById(player._id);
            if (freshPlayer) {
                io.emit('treasury_updated', {
                    gold: freshPlayer.gold,
                    resources: freshPlayer.resources,
                    crew: freshPlayer.crew,
                    settlers: freshPlayer.settlers,
                    houses: freshPlayer.houses
                });
            }

        } catch (error) {
            console.error("❌ Błąd w ekonomii:", error);
        }
    }, 15000);
}

module.exports = startEconomyLoop;