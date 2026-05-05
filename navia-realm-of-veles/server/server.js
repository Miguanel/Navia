require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./src/config/db');
const Building = require('./src/models/Building');
const NPC = require('./src/models/Npc');
const Player = require('./src/models/Player');
const Expedition = require('./src/models/Expedition');

const startEconomyLoop = require('./src/services/economy');
const startExpeditionLoop = require('./src/services/expeditions');
const startRandomEventsLoop = require('./src/services/randomEvents');
const startTimeLoop = require('./src/services/timeEngine');
const { craftWeapon } = require('./src/services/blacksmith'); // Dopasuj ścieżkę
const { handleDraftRecruit } = require('./src/services/barracks');

const app = express();

app.use(cors());

// --- UDOSTĘPNIANIE FRONTENDU PRZEZ NODE.JS ---
// Zakładam, że folder 'client' jest obok folderu 'server'
// --- POPRAWIONE ŚCIEŻKI STATYCZNE ---
// Musimy uwzględnić, że server.js jest w folderze 'server',
// a pliki klienta są obok w 'client'.
app.use(express.static(path.join(__dirname, '../client/public')));
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../client/src/map')));
app.use(express.static(path.join(__dirname, '../client/src/ui')));
app.use(express.static(path.join(__dirname, '../client/src/buildings')));// Alternatywna ścieżka, jeśli index.html jest prosto w /client
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// POŁĄCZENIE Z BAZĄ I CZYSZCZENIE
connectDB().then(async () => {
    try {
        await Building.deleteMany({ type: { $nin: ['city', 'sawmill', 'mine', 'watchtower', 'shrine', 'herbalist_hut', 'hunter_hut', 'fields'] } });
        await NPC.deleteMany({ role: { $ne: 'caravan' } });
        console.log("🧹 Baza danych gotowa i oczyszczona.");

        // === PRZENIESIONE SILNIKI GRY ===
        // Uruchamiamy je DOPIERO, gdy baza danych jest połączona!
        startEconomyLoop(io);
        startExpeditionLoop(io);
        startRandomEventsLoop(io);
        startTimeLoop(io);
        console.log("⚙️ Silniki gry zostały pomyślnie uruchomione.");

    } catch(e) {
        console.error("Błąd czyszczenia bazy:", e);
    }
});



io.on('connection', async (socket) => {
    console.log(`[+] Władyka połączony.`);
    try {
        const craftingPath = path.join(__dirname, './src/data/crafting.json');
        const craftingDef = JSON.parse(fs.readFileSync(craftingPath, 'utf8'));
        socket.emit('load_crafting_rules', craftingDef);

        const buildingsPath = path.join(__dirname, './src/data/buildings.json');
        const buildingsDef = JSON.parse(fs.readFileSync(buildingsPath, 'utf8'));
        socket.emit('load_building_rules', buildingsDef);

        socket.emit('load_buildings', await Building.find());
        socket.emit('load_npcs', await NPC.find());

        // Zapewnienie, że gracz istnieje na start
        let player = await Player.findOne();
        if (!player) {
            player = new Player();
            await player.save();
        }
        socket.emit('treasury_updated', {
            gold: player.gold, resources: player.resources, crew: player.crew,
            settlers: player.settlers, houses: player.houses
        });

        // NOWOŚĆ: Prześlij aktywne zagrożenia i questy do lewego panelu po wejściu do gry!
        socket.emit('active_threats_updated', player.activeThreats || []);
        // socket.emit('tavern_quests_updated', player.tavernQuests || []); // Przyszły system z Karczmą
    } catch (err) {
        console.error("❌ KRYTYCZNY BŁĄD PODCZAS WEJŚCIA DO GRY:", err);
    }

    // ==========================================
    // --- SYSTEM WYPRAW I RNG (BRUTALNA NAWIA) ---
    // ==========================================
    socket.on('start_expedition', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const { terrainType, isMagicNearby, settlerIds, durationMs } = data;

            // 1. Weryfikacja i wysłanie drużyny
            let validSettlers = [];
            for (let id of settlerIds) {
                let s = player.settlers.id(id);
                if (s && s.status === 'idle') {
                    s.status = 'expedition';
                    validSettlers.push(s);
                }
            }

            if (validSettlers.length === 0) return socket.emit('error_msg', "Twoi ludzie nie mogą teraz wyruszyć.");
            await player.save();

            // Odświeżamy HUD (ludzie znikają z grodu)
            io.emit('treasury_updated', {
                gold: player.gold,
                resources: player.resources,
                settlers: player.settlers,
                houses: player.houses
            });

            // 2. Oczekiwanie na powrót (Cisza przed burzą)
            setTimeout(async () => {
                const p = await Player.findOne();
                if (!p) return;

                let currentSettlers = [];
                let combatPower = 0;
                let gatherPower = 0;

                // Zbieramy aktualne dane drużyny
                for (let id of settlerIds) {
                    let s = p.settlers.id(id);
                    if (s && s.status === 'expedition') {
                        currentSettlers.push(s);
                        // Wojownik daje 35% do szansy na wygraną
                        if (s.profession === 'warrior') combatPower += 35;
                        // Specjaliści dają bonus do ilości łupów
                        if (s.profession === 'herbalist' || s.profession === 'woodcutter') gatherPower += 40;
                    }
                }

                if (currentSettlers.length === 0) return;

                let eventLog = [];
                let loot = {};
                let roll = Math.floor(Math.random() * 100) + 1;

                // --- DECYZJA: WALKA CZY EKSPLORACJA? ---
                // Jeśli MagicNearby, szansa na walkę to 60%, inaczej 30%
                let encounterChance = isMagicNearby ? 60 : 30;

                if (roll <= encounterChance) {
                    // --- SCENARIUSZ: WALKA ---
                    // Bazowa szansa na wygraną: 15% + bonusy z wojowników
                    let winChance = 15 + combatPower;
                    let fightRoll = Math.floor(Math.random() * 100) + 1;

                    if (fightRoll <= winChance) {
                        eventLog.push("⚔️ Zasadzka! Drużyna stawiła czoła biesom i zwyciężyła!");
                        loot.pelts = Math.floor(Math.random() * 4) + 1;
                        if (isMagicNearby) loot.gold = Math.floor(Math.random() * 30) + 10;
                    } else {
                        // PORAŻKA W WALCE - RYZYKO ŚMIERCI
                        eventLog.push("💀 Tragedia! Bestie rozbiły oddział...");

                        // Wybieramy ofiarę
                        let victimIndex = Math.floor(Math.random() * currentSettlers.length);
                        let victim = currentSettlers[victimIndex];

                        // 40% szansy na śmierć, jeśli przegrali walkę
                        if (Math.random() < 0.4) {
                            eventLog.push(`❌ ${victim.name} nie zdołał uciec. Poległ w dziczy.`);
                            p.settlers.pull(victim._id); // Usuwamy osadnika z bazy!
                        } else {
                            eventLog.push(`🤕 ${victim.name} wraca ledwo żywy z głębokimi ranami.`);
                            victim.status = 'resting'; // Musi odpocząć
                        }

                        // Reszta ucieka (status idle)
                        currentSettlers.forEach((s, idx) => {
                            if (idx !== victimIndex && s.status === 'expedition') s.status = 'idle';
                        });
                    }
                } else {
                    // --- SCENARIUSZ: POKOJOWA EKSPLORACJA ---
                    eventLog.push("🌿 Drużyna bezpiecznie przeszukała okoliczne ostępy.");

                    // Generowanie łupów zależnie od terenu i gatherPower
                    const bonus = 1 + (gatherPower / 100);

                    if (terrainType === 'forest') {
                        loot.wood_birch = Math.floor((Math.random() * 8 + 4) * bonus);
                        if (Math.random() > 0.5) loot.herb_celandine = Math.floor(4 * bonus);
                    } else if (terrainType === 'water' || terrainType === 'swamp') {
                        loot.food = Math.floor((Math.random() * 10 + 5) * bonus);
                    } else {
                        loot.stone = Math.floor((Math.random() * 6 + 2) * bonus);
                    }

                    if (isMagicNearby) {
                        eventLog.push("✨ Odnaleziono ślady dawnych bogów.");
                        loot.gold = Math.floor(Math.random() * 25) + 15;
                    }

                    // Wszyscy wracają bezpiecznie
                    currentSettlers.forEach(s => { if(s.status === 'expedition') s.status = 'idle'; });
                }

                // 4. Aktualizacja Skarbca
                if (loot.gold) p.gold += loot.gold;
                for (let res in loot) {
                    p.resources[res] = (p.resources[res] || 0) + loot[res];
                }

                await p.save();

                // 5. Finalny raport
                socket.emit('expedition_finished', {
                    storyText: eventLog,
                    loot: loot,
                    terrainType: terrainType
                });

                io.emit('treasury_updated', {
                    gold: p.gold,
                    resources: p.resources,
                    settlers: p.settlers,
                    houses: p.houses
                });

            }, durationMs);

        } catch (err) {
            console.error("Błąd systemu wypraw:", err);
        }
    });
    // ==========================================
    // --- SYSTEM FABULARNY: DECYZJE W WYDARZENIACH ---
    // ==========================================

    // --- OBSŁUGA WYBORÓW W WYDARZENIACH LOSOWYCH ---
    socket.on('event_choice_made', async (data) => {
        try {
            const { eventId, choiceId } = data;
            const player = await Player.findOne();
            if (!player) return;

            // 1. Znajdź dane wydarzenia w pliku JSON
            const filePath = path.join(__dirname, './src/data/randomEvents.json');
            const events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const eventData = events.find(e => e.id === eventId);
            const choice = eventData?.choices.find(c => c.id === choiceId);

            if (!choice) return;

            // 2. SPRAWDZENIE KOSZTÓW (Zabezpieczenie przed oszustwami)
            if (choice.cost) {
                for (let [res, amount] of Object.entries(choice.cost)) {
                    if (res === 'gold') {
                        if (player.gold < amount) return socket.emit('error_msg', "Brak złota!");
                    } else {
                        if ((player.resources[res] || 0) < amount) return socket.emit('error_msg', "Brak surowców!");
                    }
                }
                // Pobieranie kosztów
                for (let [res, amount] of Object.entries(choice.cost)) {
                    if (res === 'gold') player.gold -= amount;
                    else player.resources[res] -= amount;
                }
            }

            // 3. NAKŁADANIE EFEKTÓW (Nagrody)
            if (choice.effects) {
                for (let [res, amount] of Object.entries(choice.effects)) {
                    if (res === 'gold') player.gold += amount;
                    else player.resources[res] = (player.resources[res] || 0) + amount;
                }
            }

            // 4. ZARZĄDZANIE FLAGAMI (Historia świata)
            if (choice.setFlag) {
                player.set(`eventFlags.${choice.setFlag}`, true);
            }
            if (choice.removeFlag) {
                player.set(`eventFlags.${choice.removeFlag}`, undefined); // Usuwa flagę
            }

            // 5. DODAWANIE ZAGROŻEŃ (Np. Zmara)
            if (choice.addThreat) {
                player.activeThreats.push(choice.addThreat);
            }

            await player.save();

            // 6. AKTUALIZACJA FRONTENDU
            socket.emit('action_success', "Los został przypieczętowany.");

            // Wysyłamy aktualizację skarbca i osadników
            io.emit('treasury_updated', {
                gold: player.gold,
                resources: player.resources,
                settlers: player.settlers,
                houses: player.houses
            });

            // Jeśli dodano zagrożenie, odświeżamy panel zagrożeń
            if (choice.addThreat) {
                socket.emit('active_threats_updated', player.activeThreats);
            }

        } catch (err) {
            console.error("Błąd obsługi wyboru eventu:", err);
        }
    });

    // ==========================================
    // --- WYSTAWIANIE ZAGROŻEŃ JAKO ZLECEŃ W KARCZMIE ---
    // ==========================================
    socket.on('post_bounty_request', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // Znajdź zagrożenie
            const threatIndex = player.activeThreats.findIndex(t => t.id === data.threatId);
            if (threatIndex === -1) return;

            const threat = player.activeThreats[threatIndex];

            // Czy stać nas na wystawienie listu gończego?
            if (player.gold < (threat.bountyCost || 100)) {
                return socket.emit('error_msg', "Brakuje złota na nagrodę w Karczmie!");
            }

            // Płacimy z góry i usuwamy zagrożenie z lewego panelu!
            player.gold -= (threat.bountyCost || 100);
            player.activeThreats.splice(threatIndex, 1);
            player.markModified('activeThreats');

            // Dodajemy zlecenie do Karczmy!
            if (!player.tavernQuests) player.tavernQuests = [];
            player.tavernQuests.push({
                id: `quest_${threat.id}_${Date.now()}`,
                title: `Zlecenie: ${threat.name}`,
                desc: `Pokonaj bestię, by przywrócić porządek w Grodzie. Złoto opłacone z góry!`,
                rewardText: `${threat.bountyCost || 100} 💰`,
                rewardGold: threat.bountyCost || 100, // <--- DODAJ TĘ LINIJKĘ
                req: 'warrior'
            });
            player.markModified('tavernQuests');

            await player.save();

            // Powiadomienie wszystkich
            const uPlayer = await Player.findById(player._id);
            io.emit('treasury_updated', { gold: uPlayer.gold, resources: uPlayer.resources, crew: uPlayer.crew, settlers: uPlayer.settlers, houses: uPlayer.houses });
            io.emit('active_threats_updated', player.activeThreats);

            socket.emit('action_success', `Wystawiono List Gończy za ${threat.name} w Karczmie!`);

        } catch (err) { console.error(err); }
    });

    // ==========================================
    // --- BEZPOŚREDNI ATAK NA ZAGROŻENIE (Z PANELU WYPRAW) ---
    // ==========================================
    socket.on('attack_threat', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // Znajdź zagrożenie w pamięci
            const threatIndex = player.activeThreats.findIndex(t => t.id === data.threatId);
            if (threatIndex === -1) return socket.emit('error_msg', "Bestia zdążyła już zbiec lub została pokonana!");

            const threat = player.activeThreats[threatIndex];

            // Szukamy wolnego wojownika w Grodzie
            const availableWarrior = player.settlers.find(s => s.status === 'idle' && s.profession === 'warrior');
            if (!availableWarrior) {
                return socket.emit('error_msg', "Brak wolnych wojowników! Twoi ludzie są zajęci albo ranni.");
            }

            // Wysyłamy go na bitwę
            await Player.updateOne(
                { _id: player._id, "settlers._id": availableWarrior._id },
                { $set: { "settlers.$.status": "questing" } }
            );

            // Od razu usuwamy zagrożenie, by nie psuło już logistyki!
            player.activeThreats.splice(threatIndex, 1);
            player.markModified('activeThreats');
            await player.save();

            socket.emit('success_msg', `${availableWarrior.name} chwyta za miecz i idzie zabić: ${threat.name}!`);

            // Aktualizujemy front
            const updatedPlayer = await Player.findById(player._id);
            io.emit('active_threats_updated', updatedPlayer.activeThreats); // Pasek boczny znika
            io.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers, houses: updatedPlayer.houses });

            // Walka trwa 30 sekund
            setTimeout(async () => {
                const p = await Player.findOne();
                const warrior = p.settlers.find(s => s._id.toString() === availableWarrior._id.toString());

                if (warrior) {
                    // Wojownik dostaje dużo PD, ale bez złota (nie było listu gończego)
                    await Player.updateOne(
                        { _id: p._id, "settlers._id": warrior._id },
                        {
                            $set: { "settlers.$.status": "idle" },
                            $inc: { "settlers.$.exp": 30 }
                        }
                    );

                    const pFinal = await Player.findById(p._id);
                    io.emit('treasury_updated', { gold: pFinal.gold, resources: pFinal.resources, crew: pFinal.crew, settlers: pFinal.settlers, houses: pFinal.houses });

                    // Pokazujemy potężny mroczny pergamin sukcesu
                    io.emit('random_event_triggered', {
                        id: 'threat_defeated',
                        title: "Bestia Padła!",
                        description: `${warrior.name} wyłonił się z gęstwiny niosąc łeb ${threat.name}. Szlaki znów są bezpieczne.`,
                        icon: '⚔️',
                        effectsText: `+30 Doświadczenia dla Wojownika`
                    });
                }
            }, 30000);

        } catch (err) { console.error("Błąd podczas walki z zagrożeniem:", err); }
    });

    // ==========================================
    // KOSZARY - POBIERANIE KANDYDATÓW
    // ==========================================
    socket.on('get_draft_candidates', async () => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // Szukamy tylko wolnych chłopów
            const idlePeasants = player.settlers.filter(s => s.status === 'idle' && s.profession === 'peasant');
            // Szukamy tylko unikalnych broni z Kuźni
            const weapons = player.armory || [];

            socket.emit('draft_candidates_data', { candidates: idlePeasants, armory: weapons });
        } catch (err) { console.error(err); }
    });

    socket.on('get_barracks_data', async () => {
        try {
            const player = await Player.findOne({ userId: socket.userId });
            if (!player) return;
            const warriors = player.settlers.filter(s => s.profession === 'warrior');
            socket.emit('barracks_data', { warriors, armory: player.armory || [] });
        } catch (err) { console.error(err); }
    });
    // ==========================================
    // --- SPICHLERZ: Sycący Posiłek ---
    // ==========================================
    socket.on('feed_settlers', async () => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const foodCost = 20;
            if ((player.resources.food || 0) >= foodCost) {

                let restedCount = 0;

                // Szukamy osadników, którzy aktualnie śpią po pracy
                player.settlers.forEach(s => {
                    if (s.status === 'resting') {
                        s.status = 'idle'; // Natychmiastowe obudzenie!
                        restedCount++;
                    }
                });

                if (restedCount === 0) {
                     return socket.emit('error_msg', "Nikt w Grodzie nie potrzebuje teraz odpoczynku!");
                }

                // Zapisujemy zmiany w Skarbcu i Księdze Ludności
                await Player.updateOne(
                    { _id: player._id },
                    {
                        $inc: { 'resources.food': -foodCost },
                        $set: { settlers: player.settlers }
                    }
                );

                const updated = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers, houses: updated.houses });
                socket.emit('action_success', `Wydano racje żywnościowe! ${restedCount} osadników natychmiast wróciło do sił.`);
            } else {
                socket.emit('error_msg', "Brakuje żywności w Spichlerzu! (Wymagane: 20 🌾)");
            }
        } catch (err) { console.error(err); }
    });

    // ==========================================
    // --- KARCZMA: Organizacja Biesiady ---
    // ==========================================
    socket.on('hold_feast', async () => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const foodCost = 50;
            if ((player.resources.food || 0) >= foodCost) {

                let expGainedCount = 0;

                // Szukamy wolnych osadników i dodajemy im 5 PD
                player.settlers.forEach(s => {
                    if (s.status === 'idle') {
                        s.exp = (s.exp || 0) + 5;
                        expGainedCount++;

                        // Awans jeśli osiągnie 50 PD
                        if (s.exp >= 50 && s.profession === 'peasant') {
                            // Zostaje z domyślnym statusem, ale nie awansuje na nic konkretnego bez przydziału
                            // W naszym kodzie awanse następują automatycznie przy pracy, więc tutaj dajemy tylko PD!
                        }
                    }
                });

                // Zapisujemy zmiany w Skarbcu i Osadnikach
                await Player.updateOne(
                    { _id: player._id },
                    {
                        $inc: { 'resources.food': -foodCost },
                        $set: { settlers: player.settlers }
                    }
                );

                const updated = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers, houses: updated.houses });
                socket.emit('action_success', `Wyprawiono huczną biesiadę! ${expGainedCount} wolnych osadników zyskało +5 PD.`);
            } else {
                socket.emit('error_msg', "Brakuje żywności na ucztę! (Wymagane: 50 🌾)");
            }
        } catch (err) { console.error(err); }
    });

    // ==========================================
    // --- BUDOWANIE (MAKRO) NA MAPIE ŚWIATA Z JSON ---
    // ==========================================
    socket.on('build_request', async (data) => {
        try {
            const { type, lat, lng } = data;
            const player = await Player.findOne();
            if (!player) return socket.emit('error_msg', "Nie znaleziono Władycy!");

            // 1. Wczytanie Księgi Budynków
            const buildingsPath = path.join(__dirname, './src/data/buildings.json');
            const buildingsDef = JSON.parse(fs.readFileSync(buildingsPath, 'utf8'));
            const bData = buildingsDef[type];

            if (!bData) return socket.emit('error_msg', "Próbujesz wznieść nieznaną budowlę!");

            // 2. Weryfikacja kosztów i pobranie surowców
            if (bData.cost) {
                // Sprawdzamy czy gracza stać
                for (let [res, amount] of Object.entries(bData.cost)) {
                    if (res === 'gold') {
                        if (player.gold < amount) return socket.emit('error_msg', `Brakuje złota: ${amount} 💰`);
                    } else {
                        if ((player.resources[res] || 0) < amount) return socket.emit('error_msg', `Brakuje surowca: ${res} (${amount} szt.)`);
                    }
                }
                // Pobieramy surowce ze skarbca
                for (let [res, amount] of Object.entries(bData.cost)) {
                    if (res === 'gold') player.gold -= amount;
                    else player.resources[res] -= amount;
                }
            }

            // 3. Zapis zmian w graczu
            player.markModified('resources');
            await player.save();

            // 4. Stworzenie placówki w Bazie Danych
            const newBuilding = new Building({ type, location: { lat, lng }, storage: {} });

            // --- NOWOŚĆ: SYSTEM WYTRZYMAŁOŚCI DLA BUDYNKÓW NA MAPIE ---
            // Zliczamy drewno zużyte z domyślnego kosztu w buildings.json
            let paidWoodBirch = bData.cost ? (bData.cost['wood_birch'] || 0) : 0;
            let paidWoodAsh = bData.cost ? (bData.cost['wood_ash'] || 0) : 0;
            let paidWoodOak = bData.cost ? (bData.cost['wood_oak'] || 0) : 0;
            let totalWoodDurability = paidWoodBirch + paidWoodAsh + paidWoodOak;

            // Jeśli budynek kosztował jakiekolwiek drewno, nadajemy mu punkty zdrowia!
            if (totalWoodDurability > 0) {
                if (!newBuilding.buildingHealth) newBuilding.buildingHealth = new Map();

                // Zapisujemy pod kluczem 'core' (główny szkielet budynku na mapie)
                newBuilding.buildingHealth.set('core', {
                    maxDurability: totalWoodDurability,
                    currentDecayStep: 0,
                    currentMaterials: {
                        wood_birch: paidWoodBirch,
                        wood_ash: paidWoodAsh,
                        wood_oak: paidWoodOak
                    }
                });
            }

            const savedBuilding = await newBuilding.save();

            // Informujemy mapę, by narysowała budynek
            io.emit('building_placed', savedBuilding);

            // Jeśli to Główny Gród (city), generujemy pierwszą Karawanę
            if (type === 'city') {
                const caravan = new NPC({ name: "Karawana", role: 'caravan', location: { lat, lng } });
                io.emit('npc_spawned', await caravan.save());
            }

            // 5. Powiadomienie budowniczego i odświeżenie HUD
            const updatedPlayer = await Player.findById(player._id);
            socket.emit('treasury_updated', {
                gold: updatedPlayer.gold,
                resources: updatedPlayer.resources,
                crew: updatedPlayer.crew,
                settlers: updatedPlayer.settlers,
                houses: updatedPlayer.houses
            });
            socket.emit('action_success', `Wzniesiono: ${bData.name}! Zabezpieczono konstrukcję.`);

        } catch (err) {
            console.error("Błąd wznoszenia budynku z JSON:", err);
            socket.emit('error_msg', "Wystąpił błąd budowy.");
        }
    });

    // ==========================================
    // --- PODEJMOWANIE ZLECEŃ Z KARCZMY ---
    // ==========================================
    socket.on('start_quest', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // 1. Sprawdzamy czy zlecenie nadal istnieje w bazie
            const questIndex = player.tavernQuests.findIndex(q => q.id === data.questId);
            if (questIndex === -1) {
                return socket.emit('error_msg', "To zlecenie zostało już przyjęte lub jest nieaktualne!");
            }
            const quest = player.tavernQuests[questIndex];

            // 2. Szukamy wolnego wojownika
            const availableWarrior = player.settlers.find(s => s.status === 'idle' && s.profession === 'warrior');
            if (!availableWarrior) {
                return socket.emit('error_msg', "Brak wolnych wojowników! Twoi ludzie są zajęci albo ranni.");
            }

            // 3. Wysyłamy wojownika i USUWAmy zlecenie z tablicy w Karczmie
            await Player.updateOne(
                { _id: player._id, "settlers._id": availableWarrior._id },
                { $set: { "settlers.$.status": "questing" } }
            );

            player.tavernQuests.splice(questIndex, 1);
            player.markModified('tavernQuests');
            await player.save();

            socket.emit('success_msg', `${availableWarrior.name} chwyta za miecz i wyrusza by wykonać: ${quest.title}!`);

            // Odświeżamy Karczmę na ekranie (Zlecenie znika!)
            const updatedPlayer = await Player.findById(player._id);
            io.emit('treasury_updated', {
                gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew,
                settlers: updatedPlayer.settlers, houses: updatedPlayer.houses,
                tavernQuests: updatedPlayer.tavernQuests // <--- WYSYŁAMY QUESTY NA FRONT
            });

            // 4. Misja trwa 30 sekund
            const questDuration = 30000;
            setTimeout(async () => {
                const p = await Player.findOne();
                const warrior = p.settlers.find(s => s._id.toString() === availableWarrior._id.toString());

                if(warrior) {
                    const rewardGold = quest.rewardGold || 100; // Nagroda ze zlecenia

                    await Player.updateOne(
                        { _id: p._id, "settlers._id": warrior._id },
                        {
                            $set: { "settlers.$.status": "idle" },
                            $inc: { "settlers.$.exp": 25, gold: rewardGold }
                        }
                    );

                    const pFinal = await Player.findById(p._id);
                    io.emit('treasury_updated', {
                        gold: pFinal.gold, resources: pFinal.resources, crew: pFinal.crew,
                        settlers: pFinal.settlers, houses: pFinal.houses, tavernQuests: pFinal.tavernQuests
                    });

                    // Zakończenie misji na pergaminie
                    io.emit('random_event_triggered', {
                        id: 'quest_completed',
                        title: "Zlecenie Zakończone",
                        description: `${warrior.name} powraca z odciętym łbem bestii! Szlaki znów są bezpieczne.`,
                        icon: '⚔️',
                        effectsText: `Odzyskano ${rewardGold} 💰`
                    });
                }
            }, questDuration);

        } catch(err) { console.error("Błąd podejmowania zlecenia:", err); }
    });
    // --- BAZA RECEPTUR RZEMIEŚLNICZYCH ---
    const CRAFTING_RECIPES = {
        'wpn_sword':  { cost: { gold: 10, stone: 5, wood_oak: 2 },        result: { wpn_sword: 1 } },
        'wpn_bow':    { cost: { gold: 15, wood_ash: 8 },                  result: { wpn_bow: 1 } },
        'shd_wood':   { cost: { gold: 5,  wood_birch: 10 },               result: { shd_wood: 1 } },
        'pot_heal':   { cost: { gold: 5,  herb_celandine: 3 },            result: { pot_heal: 1 } },
        'pot_poison': { cost: { gold: 10, herb_wolfsbane: 5 },            result: { pot_poison: 1 } }
    };

    // --- LOGIKA PRODUKCJI ---

    // ==========================================
    // --- ZAAWANSOWANA KUŹNIA (Z PLIKU JSON) ---
    // ==========================================
    socket.on('advanced_crafting_request', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const { masterId, helperId, itemType, primaryMat, secondaryMat } = data;

            // Wczytanie Księgi Rzemiosła
            const craftingPath = path.join(__dirname, './src/data/crafting.json');
            const craftingRules = JSON.parse(fs.readFileSync(craftingPath, 'utf8'));

            const blueprint = craftingRules.blueprints[itemType];
            const pMat = craftingRules.primaryMaterials[primaryMat];
            const sMat = craftingRules.secondaryMaterials[secondaryMat];

            if (!blueprint || !pMat || !sMat) return socket.emit('error_msg', "Nieznany schemat lub surowiec!");

            // 1. Walidacja surowców w Skarbcu
            if ((player.resources[primaryMat] || 0) < blueprint.cost.primary ||
                (player.resources[secondaryMat] || 0) < blueprint.cost.secondary) {
                return socket.emit('error_msg', "Brakuje surowców w Skarbcu!");
            }

            const master = player.settlers.id(masterId);
            const helper = helperId ? player.settlers.id(helperId) : null;

            if (!master || master.status !== 'idle') {
                return socket.emit('error_msg', "Wskazany Mistrz jest zajęty lub nie istnieje!");
            }

            // 2. Pobranie surowców
            player.resources[primaryMat] -= blueprint.cost.primary;
            player.resources[secondaryMat] -= blueprint.cost.secondary;

            // 3. OBLICZANIE SZANSY (Z JSON)
            let baseChance = 40;
            baseChance -= blueprint.difficulty;
            baseChance -= pMat.difficulty;
            baseChance -= sMat.difficulty;

            if (master.profession === 'blacksmith') baseChance += 30;
            baseChance += Math.floor((master.exp || 0) / 2);

            if (helper) {
                baseChance += 15;
                if (helper.profession === 'blacksmith') baseChance += 10;
            }

            if (baseChance > 95) baseChance = 95;
            if (baseChance < 5) baseChance = 5;

            // 4. RZUT KOŚCIĄ!
            const roll = Math.floor(Math.random() * 100) + 1;

            if (roll <= baseChance) {
                // --- SUKCES! WYTWARZAMY PRZEDMIOT ---
                let rarity = pMat.baseRarity;
                if (sMat.rarityUpgrade) rarity = "Znakomity";

                let finalName = `${pMat.prefix} ${blueprint.name}`;
                let finalDmg = blueprint.baseDmg + pMat.dmgBonus + sMat.dmgBonus;

                // Krytyk rzemieślniczy
                if (roll <= baseChance / 4) {
                    finalName = "Mistrzowski " + finalName;
                    finalDmg += 3;
                    rarity = "Legendarny";
                }

                const newWeapon = {
                    id: 'wpn_' + Date.now(),
                    type: itemType,
                    name: finalName,
                    damage: finalDmg,
                    trait: sMat.traitName,
                    rarity: rarity,
                    craftedBy: master.name
                };

                if (!player.armory) player.armory = [];
                player.armory.push(newWeapon);

                master.exp += 15;
                if (master.profession === 'peasant') {
                    master.profession = 'blacksmith';
                    socket.emit('action_success', `${master.name} zostaje pełnoprawnym Kowalem!`);
                }
                if (helper) helper.exp += 5;

                socket.emit('action_success', `Wykuto: ${finalName} (Obrażenia: ${finalDmg})`);
            } else {
                // --- PORAŻKA ---
                master.exp += 5;
                if (helper) helper.exp += 2;
                socket.emit('error_msg', "Materiały pękły w ogniu...");
            }

            // 5. Zapis zmian
            player.markModified('resources');
            player.markModified('armory');
            player.markModified('settlers');
            await player.save();

            const p = await Player.findById(player._id);
            io.emit('treasury_updated', { gold: p.gold, resources: p.resources, crew: p.crew, settlers: p.settlers, houses: p.houses });

        } catch (err) { console.error(err); }
    });
    socket.on('craft_item', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const recipe = CRAFTING_RECIPES[data.item];
            if (!recipe) return socket.emit('error_msg', "Nieznana receptura!");

            // 1. Sprawdzamy, czy gracz ma wymagane surowce i złoto
            let canAfford = true;
            for (let [resName, costValue] of Object.entries(recipe.cost)) {
                if (resName === 'gold') {
                    if (player.gold < costValue) canAfford = false;
                } else {
                    if ((player.resources[resName] || 0) < costValue) canAfford = false;
                }
            }

            if (!canAfford) {
                return socket.emit('error_msg', "Brak surowców lub złota na to zlecenie!");
            }

            // 2. Pobieramy zapłatę
            for (let [resName, costValue] of Object.entries(recipe.cost)) {
                if (resName === 'gold') {
                    player.gold -= costValue;
                } else {
                    player.resources[resName] -= costValue;
                }
            }

            // 3. Dodajemy wytworzony przedmiot do magazynu
            for (let [resName, yieldValue] of Object.entries(recipe.result)) {
                player.resources[resName] = (player.resources[resName] || 0) + yieldValue;
            }

            // 4. Zapisujemy w bazie i odświeżamy grę
            player.markModified('resources');
            await player.save();

            socket.emit('success_msg', "Przedmiot został pomyślnie wytworzony!");
            io.emit('treasury_updated', { gold: player.gold, resources: player.resources, settlers: player.settlers, houses: player.houses });

        } catch (err) {
            console.error("Błąd rzemiosła:", err);
        }
    });
    // ==========================================
    // ZBROJOWNIA - POBIERANIE EKWIPUNKU
    // ==========================================
    socket.on('get_armory_request', async () => {
        try {
            // Pobieramy gracza z bazy (dostosuj zapytanie do swojego modelu)
            const player = await Player.findOne({ userId: socket.userId });
            if (player) {
                // Odsyłamy tablicę armory (jeśli nie istnieje, wysyłamy pustą)
                socket.emit('armory_data', { armory: player.armory || [] });
            }
        } catch (err) {
            console.error("Błąd pobierania Zbrojowni:", err);
        }
    });
    // ==========================================
    // --- KOSZARY: ROZPOCZĘCIE MUSZTRY ---
    // ==========================================
    socket.on('draft_recruit_request', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // 1. Weryfikacja
            const settler = player.settlers.id(data.settlerId);
            if (!settler || settler.status !== 'idle' || settler.profession !== 'peasant') {
                return socket.emit('error_msg', "Ten osadnik nie może rozpocząć szkolenia!");
            }

            const weaponIndex = player.armory.findIndex(w => w.id === data.weaponId);
            if (weaponIndex === -1) {
                return socket.emit('error_msg', "Ta broń zniknęła ze Zbrojowni!");
            }

            // 2. Pobranie broni ze Zbrojowni
            const chosenWeapon = player.armory[weaponIndex];
            player.armory.splice(weaponIndex, 1);
            player.markModified('armory');

            // 3. Przypisanie do chłopa i zmiana statusu
            const trainingTimeMs = 60000; // 1 MINUTA (Testy)

            settler.status = 'training';
            settler.trainingEndTime = Date.now() + trainingTimeMs;
            settler.equipment = { weapon: chosenWeapon, armor: null };
            // Tworzymy mu biegłość w danym typie broni (np. 'sword': 1)
            settler.proficiencies = { [chosenWeapon.type]: 1 };

            await player.save();

            // Odświeżenie widoku
            const updatedPlayer = await Player.findById(player._id);
            socket.emit('success_msg', `${settler.name} bierze ${chosenWeapon.name} i rusza na plac treningowy!`);
            io.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers, houses: updatedPlayer.houses });

            // 4. Odliczanie do końca szkolenia
            setTimeout(async () => {
                const p = await Player.findOne();
                const trainedSettler = p.settlers.id(data.settlerId);

                if (trainedSettler && trainedSettler.status === 'training') {
                    trainedSettler.status = 'idle';
                    trainedSettler.profession = 'warrior'; // Nareszcie staje się wojownikiem!
                    await p.save();

                    const finalPlayer = await Player.findById(p._id);
                    io.emit('treasury_updated', { gold: finalPlayer.gold, resources: finalPlayer.resources, crew: finalPlayer.crew, settlers: finalPlayer.settlers, houses: finalPlayer.houses });

                    // Powiadomienie fabularne
                    io.emit('random_event_triggered', {
                        id: 'training_completed',
                        title: "Szkolenie Zakończone",
                        description: `${trainedSettler.name} ukończył musztrę! Od dziś z dumą dzierży swój ${chosenWeapon.name} w obronie Grodu.`,
                        icon: '⚔️',
                        effectsText: `Nowy Wojownik gotowy do akcji!`
                    });
                }
            }, trainingTimeMs);

        } catch (err) { console.error("Błąd musztry:", err); }
    });
    // ==========================================
    // --- ROZBUDOWA WEWNĘTRZNA (Z dokładną płatnością) ---
    // ==========================================
    socket.on('upgrade_building_request', async (data) => {
        try {
            const player = await Player.findOne();
            const building = await Building.findById(data.buildingId);
            if (!player || !building || building.upgrades.includes(data.upgradeType)) return;

            const upgradeCosts = {
                'tavern': { gold: 200, wood: 100, stone: 0 },
                'market': { gold: 300, wood: 150, stone: 50 },
                'blacksmith': { gold: 400, wood: 100, stone: 200 },
                'barracks': { gold: 500, wood: 200, stone: 100 },
                'alchemist': { gold: 1000, wood: 200, stone: 200 },
                'stables': { gold: 300, wood: 200, stone: 0 },
                'granary': { gold: 200, wood: 200, stone: 0 },
                'walls': { gold: 500, wood: 0, stone: 500 },
                'capitol': { gold: 2000, wood: 500, stone: 500 },
                'farm': { gold: 300, wood: 150, stone: 0 },
            };
            const cost = upgradeCosts[data.upgradeType];
            if (!cost) return;

            // 1. Sprawdzamy ZŁOTO
            if (player.gold < cost.gold) return socket.emit('error_msg', "Brakuje złota!");

            // 2. Walidacja Płatności Surowcowej (Security Check)
            const payment = data.payment || {};
            let paidWood = 0;
            let paidStone = 0;

            for (const [resKey, amount] of Object.entries(payment)) {
                if (amount < 0) return socket.emit('error_msg', "Magia oszustwa nie zadziała!"); // Zabezpieczenie przed liczbami ujemnymi
                if ((player.resources[resKey] || 0) < amount) return socket.emit('error_msg', `Nie masz wystarczająco dużo: ${resKey}`);

                if (['wood_birch', 'wood_oak', 'wood_ash'].includes(resKey)) paidWood += amount;
                if (resKey === 'stone') paidStone += amount;
            }

            if (paidWood !== cost.wood || paidStone !== cost.stone) {
                return socket.emit('error_msg', "Ilość zadeklarowanych surowców nie zgadza się z kosztem budowy!");
            }

            // 3. Pobieramy zapłatę, skoro wszystko się zgadza
            player.gold -= cost.gold;
            for (const [resKey, amount] of Object.entries(payment)) {
                player.resources[resKey] -= amount;
            }

            player.markModified('resources');
            await player.save();

            // 4. Budujemy i Rejestrujemy Użyte Surowce
            building.upgrades.push(data.upgradeType);

            // Obliczamy ile drewna zużyto
            let paidWoodBirch = payment['wood_birch'] || 0;
            let paidWoodAsh = payment['wood_ash'] || 0;
            let paidWoodOak = payment['wood_oak'] || 0;
            let totalWoodDurability = paidWoodBirch + paidWoodAsh + paidWoodOak;

            // --- KRYTYCZNA POPRAWKA: Tarcza ochronna dla starych zapisów ---
            // Jeśli budynek jest stary i nie ma jeszcze miejsca na uszkodzenia, tworzymy je!
            if (!building.buildingHealth) {
                building.buildingHealth = new Map();
            }

            // Inicjalizujemy logikę uszkodzeń (tylko jeśli budynek kosztował jakieś drewno)
            if (totalWoodDurability > 0) {
                building.buildingHealth.set(data.upgradeType, {
                    maxDurability: totalWoodDurability,
                    currentDecayStep: 0,
                    currentMaterials: {
                        wood_birch: paidWoodBirch,
                        wood_ash: paidWoodAsh,
                        wood_oak: paidWoodOak
                    }
                });
            }

            building.markModified('buildingHealth'); // Wymuszamy na bazie Mongoose zapisanie Mapy!
            await building.save();

            const updatedPlayer = await Player.findById(player._id);
            socket.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers, houses: updatedPlayer.houses });
            io.emit('building_upgraded', building);
            socket.emit('action_success', "Wzniesiono nową budowlę w Grodzie!");

        } catch (err) { console.error(err); }
    });



    // ==========================================
    // --- INTERAKCJE Z BUDYNKAMI ---
    // ==========================================
    // ==========================================
    // --- ODBUDOWA BUDYNKÓW (WARSZTAT CIEŚLI) ---
    // ==========================================
    socket.on('repair_building_request', async (data) => {
        try {
            const player = await Player.findOne();
            const building = await Building.findById(data.buildingId);

            // Weryfikacja
            if (!player || !building || !building.buildingHealth) return;

            // Szukamy danych zdrowia konkretnego budynku
            const healthData = building.buildingHealth.get(data.upgradeType);
            if (!healthData) return;

            // GŁĘBOKA KOPIA - niezbędne, by baza danych Mongoose zapisała zmiany!
            let updatedHealth = JSON.parse(JSON.stringify(healthData));

            const payment = data.payment || {};
            let totalRepaired = 0;

            // Walidacja Płatności
            for (const [resKey, amount] of Object.entries(payment)) {
                if (amount <= 0) continue;
                if ((player.resources[resKey] || 0) < amount) {
                    return socket.emit('error_msg', `Brakuje surowca w Skarbcu: ${resKey}`);
                }

                // Zdejmujemy drewno ze Skarbca gracza
                player.resources[resKey] -= amount;

                // Dolepiamy nową deskę do struktury budynku
                updatedHealth.currentMaterials[resKey] = (updatedHealth.currentMaterials[resKey] || 0) + amount;
                totalRepaired += amount;
            }

            // Jeśli zużyto jakiekolwiek surowce, zapisujemy postęp
            if (totalRepaired > 0) {
                player.markModified('resources');
                await player.save();

                // Zapisujemy nowy stan budynku w bazie
                building.buildingHealth.set(data.upgradeType, updatedHealth);
                building.markModified('buildingHealth');
                await building.save();

                console.log(`[CIEŚLA] Naprawiono ${data.upgradeType}. Przywrócono ${totalRepaired} HP.`);

                // Wysyłamy nowy stan do przeglądarki
                const updatedPlayer = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers, houses: updatedPlayer.houses });

                io.emit('building_updated', building);
                socket.emit('action_success', `Prace ciesielskie zakończone! Odzyskano ${totalRepaired} pkt wytrzymałości.`);
            }

        } catch (err) {
            console.error("Błąd naprawy w Warsztacie Cieśli:", err);
        }
    });

    // ==========================================
    // --- INTERAKCJE Z BUDYNKAMI ---
    // ==========================================



    // ==========================================
    // --- ALCHEMIK: Warzenie Mikstur ---
    // ==========================================
    socket.on('brew_potions', async (data) => {
        try {
            const player = await Player.findOne();
            const amount = data.amount;

            // Koszt: 20 Ziół i 10 Złota za każdą miksturę
            const costHerbs = amount * 20;
            const costGold = amount * 10;

            if (player.gold >= costGold && (player.resources.materials.herbs || 0) >= costHerbs) {
                await Player.updateOne({ _id: player._id }, {
                    $inc: {
                        gold: -costGold,
                        'resources.materials.herbs': -costHerbs,
                        'resources.materials.potions': amount
                    }
                });
                const updated = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers, houses: updated.houses });
                socket.emit('action_success', `Uwarzono ${amount} szt. Magicznych Mikstur!`);
            } else {
                socket.emit('error_msg', "Brakuje ziół lub złota na uwarzenie mikstur!");
            }
        } catch (err) { console.error(err); }
    });

    // Koszary: Werbunek Zwykłych Osadników i Wojowników
    socket.on('recruit_units', async (data) => {
        try {
            const player = await Player.findOne();
            const mainCity = await Building.findOne({ type: 'city' });
            const { peasants, warriors } = data;

            let maxPop = 5 + (player.houses || 0) * 5;
            if (mainCity && mainCity.upgrades.includes('walls')) maxPop += 15;
            if (mainCity && mainCity.upgrades.includes('edict_military')) maxPop += 15;

            if (player.settlers.length + peasants + warriors > maxPop) return socket.emit('error_msg', "Brak miejsc w Grodzie!");

            const costGold = (peasants * 20) + (warriors * 50);
            const costWeapons = warriors * 1;
            const availableWeapons = (player.resources.wpn_sword || 0) + (player.resources.wpn_axe || 0) + (player.resources.wpn_bow || 0) + (player.resources.wpn_spear || 0);

            if (player.gold >= costGold && availableWeapons >= costWeapons) {
                player.gold -= costGold;

                let wepToTake = costWeapons;
                for (let w of ['wpn_sword', 'wpn_axe', 'wpn_bow', 'wpn_spear']) {
                    if (wepToTake <= 0) break;
                    let taken = Math.min(player.resources[w] || 0, wepToTake);
                    player.resources[w] -= taken;
                    wepToTake -= taken;
                }

                const namesM = ['Dobromir', 'Gniewko', 'Wojciech', 'Mieszko', 'Świętopełk'];
                const namesF = ['Dobrawa', 'Milena', 'Wanda', 'Bożena', 'Svetlana'];
                const traits = ['Krzepki (+Siła)', 'Bystre Oko (+Zwiad)', 'Zielone Palce (+Zioła)', 'Nieulękły (+Morale)'];

                for(let i=0; i<peasants; i++) player.settlers.push({ name: (Math.random()<0.5?namesM:namesF)[Math.floor(Math.random()*5)], profession: 'peasant', trait: traits[Math.floor(Math.random()*4)], exp: 0, status: 'idle' });
                for(let i=0; i<warriors; i++) player.settlers.push({ name: (Math.random()<0.8?namesM:namesF)[Math.floor(Math.random()*5)], profession: 'warrior', trait: traits[Math.floor(Math.random()*4)], exp: 0, status: 'idle' });

                player.markModified('resources');
                await player.save();

                const updated = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers, houses: updated.houses });
                socket.emit('action_success', `Zrekrutowano nowych poddanych do Grodu!`);
            } else socket.emit('error_msg', "Brakuje złota lub oręża!");
        } catch (err) { console.error(err); }
    });

    // ==========================================
    // --- SYSTEM HANDLU NA TARGOWISKU ---
    // ==========================================
    socket.on('trade_resource', async (data) => {
        try {
            const { action, type } = data; // np. action: 'sell', type: 'wood'
            const player = await Player.findOne();
            if (!player) return;

            // 1. ZABEZPIECZENIE: Jeśli gracz nie ma magazynu, tworzymy go
            if (!player.resources) {
                player.resources = {};
            }

            // 2. Cennik (Złoto za pakiet 10 sztuk)
            const prices = {
                wood: 5, stone: 10, food: 8, herbs: 15, pelts: 40, weapons: 50
            };

            const sellAmount = 10;
            const earnGold = prices[type];

            if (action === 'sell') {
                // Zliczamy wszystkie surowce z danej kategorii (np. 'wood', 'wood_birch', 'wood_oak')
                let totalAvailable = 0;
                for (let key in player.resources) {
                    if (key === type || key.startsWith(type + '_')) {
                        totalAvailable += player.resources[key];
                    }
                }

                // Sprawdzamy, czy gracza na to stać
                if (totalAvailable < sellAmount) {
                    return socket.emit('error_msg', `Nie masz wystarczająco towaru! Potrzebujesz ${sellAmount} szt. z kategorii: ${type}.`);
                }

                // Odejmujemy surowce (najpierw ze starych/ogólnych, potem z nowych/szczegółowych)
                let remainingToDeduct = sellAmount;
                for (let key in player.resources) {
                    if ((key === type || key.startsWith(type + '_')) && player.resources[key] > 0) {
                        let take = Math.min(player.resources[key], remainingToDeduct);
                        player.resources[key] -= take;
                        remainingToDeduct -= take;

                        // Jeśli zebraliśmy już 10 sztuk na sprzedaż, kończymy pobieranie
                        if (remainingToDeduct <= 0) break;
                    }
                }

                // Dodajemy złoto do skarbca
                if (!player.gold) player.gold = 0;
                player.gold += earnGold;

                // KLUCZOWE W MONGOOSE: Jeśli edytujemy zagnieżdżony obiekt (resources), musimy o tym powiedzieć bazie!
                player.markModified('resources');
                await player.save();

                // Wysyłamy potwierdzenie do gracza
                socket.emit('action_success', `Sprzedano towary. Zarobiono ${earnGold} 💰.`);

                // Odświeżamy interfejs
                io.emit('treasury_updated', {
                    gold: player.gold,
                    resources: player.resources,
                    settlers: player.settlers,
                    houses: player.houses
                });
            }

        } catch (err) {
            console.error("Błąd handlu na targowisku:", err);
        }
    });
    // ==========================================
    // --- BUDOWA DOMOSTW W RATUSZU ---
    // ==========================================
    socket.on('build_house', async () => {
        try {
            const player = await Player.findOne();
            const costWood = 50; const costStone = 50;
            const totalWood = (player.resources.wood_birch || 0) + (player.resources.wood_oak || 0) + (player.resources.wood_ash || 0);
            const totalStone = player.resources.stone || 0;

            if (totalWood >= costWood && totalStone >= costStone) {
                player.resources.stone -= costStone;

                let woodToTake = costWood;
                const woodTypes = ['wood_birch', 'wood_oak', 'wood_ash'];
                for (let w of woodTypes) {
                    if (woodToTake <= 0) break;
                    let avail = player.resources[w] || 0;
                    let taken = Math.min(avail, woodToTake);
                    player.resources[w] -= taken;
                    woodToTake -= taken;
                }

                player.houses = (player.houses || 0) + 1;
                player.markModified('resources');
                await player.save();

                const updated = await Player.findById(player._id);
                socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers, houses: updated.houses });
                socket.emit('action_success', "Wzniesiono nowe domostwo!");
            } else socket.emit('error_msg', "Brakuje drewna lub kamienia na dom!");
        } catch (err) { console.error(err); }
    });
    // ==========================================
    // --- KUPNO NOWYCH KARAWAN W STAJNI ---
    // ==========================================
    socket.on('buy_caravan', async () => {
        try {
            const player = await Player.findOne();
            if (player.gold >= 200) {
                await Player.updateOne({ _id: player._id }, { $inc: { gold: -200 } });

                const mainCity = await Building.findOne({ type: 'city' });
                if (mainCity) {
                    // DODANO: Losowe, małe przesunięcie GPS, aby wozy nie stały idealnie jeden na drugim!
                    const offsetLat = (Math.random() - 0.5) * 0.002;
                    const offsetLng = (Math.random() - 0.5) * 0.002;

                    const caravan = new NPC({
                        name: "Karawana",
                        role: 'caravan',
                        location: {
                            lat: mainCity.location.lat + offsetLat,
                            lng: mainCity.location.lng + offsetLng
                        }
                    });
                    const saved = await caravan.save();
                    io.emit('npc_spawned', saved);

                    const updated = await Player.findById(player._id);
                    socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers });
                    socket.emit('action_success', "Zakupiono nową Karawanę! Wyruszy po surowce w najbliższym cyklu.");
                }
            } else {
                socket.emit('error_msg', "Brakuje złota na nowy wóz!");
            }
        } catch (err) { console.error(err); }
    });

    // ==========================================
    // --- WYPRAWY (Ekspedycje V2) ---
    // ==========================================
    // --- WYPRAWY V2 (Z Konkretnymi Osadnikami) ---
    socket.on('start_expedition_v2', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            const { target, mission, durationMs, cost, settlerIds } = data;

            if (!settlerIds || settlerIds.length === 0) return socket.emit('error_msg', "Musisz wybrać kogoś do drużyny!");
            if (player.gold < cost) return socket.emit('error_msg', "Brakuje złota na prowiant!");

            let wCount = 0, hCount = 0, warCount = 0;

            // Zmieniamy status wybranych osadników na "expedition" i liczymy ich profesje
            player.settlers.forEach(s => {
                if (settlerIds.includes(s._id.toString()) && s.status === 'idle') {
                    s.status = 'expedition';
                    if (s.profession === 'woodcutter') wCount++;
                    if (s.profession === 'herbalist') hCount++;
                    if (s.profession === 'warrior') warCount++;
                }
            });

            // Pobieramy złoto i zmniejszamy ogólne liczniki "wolnych ludzi" w Grodzie (dla bezpieczeństwa UI)
            player.gold -= cost;
            player.crew.woodcutters -= wCount;
            player.crew.herbalists -= hCount;
            player.crew.warriors -= warCount;

            await player.save();

            const updatedPlayer = await Player.findById(player._id);
            socket.emit('treasury_updated', { gold: updatedPlayer.gold, resources: updatedPlayer.resources, crew: updatedPlayer.crew, settlers: updatedPlayer.settlers });

            const newExpedition = new Expedition({
                playerId: player._id,
                target: target,
                mission: mission,
                durationMs: durationMs,
                settlerIds: settlerIds,
                crew: { woodcutters: wCount, herbalists: hCount, warriors: warCount }
            });
            await newExpedition.save();

            console.log(`📯 Drużyna ${settlerIds.length} osób wyruszyła do: ${target}`);
            socket.emit('expedition_started', { message: `Drużyna wyruszyła z Grodu! Czekaj na wieści...` });
        } catch (err) { console.error(err); }
    });
    // --- NOWOŚĆ: PRZYPISYWANIE DO PRACY W PLACÓWKACH ---
    // --- NOWOŚĆ: ZAAWANSOWANE PRZYPISYWANIE DO PRACY Z CZASEM PODRÓŻY ---
    // --- ZAAWANSOWANE PRZYPISYWANIE DO PRACY Z LIMITEM MIEJSC ---
    socket.on('assign_worker', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // Sprawdzanie limitu 5 osób
            const workersInBuilding = player.settlers.filter(s =>
                (s.status === 'working' || s.status === 'walking_to_work') && s.workplaceId === data.buildingId
            ).length;

            if (workersInBuilding >= 5) {
                return socket.emit('error_msg', "W tej placówce brakuje już miejsc! (Max 5 osób)");
            }

            // 1. Zmiana na "Zmierza do pracy"
            await Player.updateOne(
                { _id: player._id, "settlers._id": data.settlerId },
                { $set: { "settlers.$.status": "walking_to_work", "settlers.$.workplaceId": data.buildingId } }
            );

            let updated = await Player.findById(player._id);
            socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers });

            // 2. Po 5 sekundach drogi dociera na miejsce i zaczyna rąbać drewno
            setTimeout(async () => {
                await Player.updateOne(
                    { _id: player._id, "settlers._id": data.settlerId, "settlers.status": "walking_to_work" },
                    { $set: { "settlers.$.status": "working" } }
                );
                let fresh = await Player.findById(player._id);
                if(fresh) io.emit('treasury_updated', { gold: fresh.gold, resources: fresh.resources, crew: fresh.crew, settlers: fresh.settlers });
            }, 5000);

        } catch (err) { console.error(err); }
    });

    socket.on('unassign_worker', async (data) => {
        try {
            const player = await Player.findOne();
            if (!player) return;

            // 1. Zmiana na "Wraca do domu"
            await Player.updateOne(
                { _id: player._id, "settlers._id": data.settlerId },
                { $set: { "settlers.$.status": "returning_home", "settlers.$.workplaceId": null } }
            );

            let updated = await Player.findById(player._id);
            socket.emit('treasury_updated', { gold: updated.gold, resources: updated.resources, crew: updated.crew, settlers: updated.settlers });

            // 2. Po 5 sekundach wraca i musi odpocząć (nie można go od razu wysłać znów)
            setTimeout(async () => {
                await Player.updateOne(
                    { _id: player._id, "settlers._id": data.settlerId, "settlers.status": "returning_home" },
                    { $set: { "settlers.$.status": "resting" } }
                );
                let resting = await Player.findById(player._id);
                if(resting) io.emit('treasury_updated', { gold: resting.gold, resources: resting.resources, crew: resting.crew, settlers: resting.settlers });

                // 3. Po 10 sekundach snu jest wypoczęty i gotowy do akcji (Idle)
                setTimeout(async () => {
                    await Player.updateOne(
                        { _id: player._id, "settlers._id": data.settlerId, "settlers.status": "resting" },
                        { $set: { "settlers.$.status": "idle" } }
                    );
                    let idle = await Player.findById(player._id);
                    if(idle) io.emit('treasury_updated', { gold: idle.gold, resources: idle.resources, crew: idle.crew, settlers: idle.settlers });
                }, 10000);

            }, 5000);

        } catch (err) { console.error(err); }
    });
    // Burzenie budynków
    socket.on('destroy_request', async (data) => {
        await Building.findByIdAndDelete(data.buildingId);
        io.emit('building_destroyed', { buildingId: data.buildingId });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚔️ Serwer Navii działa na porcie ${PORT}`));