const fs = require('fs');
const path = require('path');
const Player = require('../models/Player');

function startRandomEventsLoop(io) {
    const filePath = path.join(__dirname, '../data/randomEvents.json');

    setInterval(async () => {
        try {
            let events = [];
            try {
                events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch(e) { console.error("Błąd czytania zdarzeń:", e); return; }

            const player = await Player.findOne();
            if (!player || events.length === 0) return;

            // Konwertujemy Mapę z Mongoose na zwykły obiekt JS dla łatwiejszego sprawdzania
            const pFlags = player.eventFlags instanceof Map ? Object.fromEntries(player.eventFlags) : (player.eventFlags || {});

            // 1. FILTROWANIE WYDARZEŃ
            const validEvents = events.filter(ev => {
                if (ev.requiresFlag && !pFlags[ev.requiresFlag]) return false;
                if (ev.excludeFlag && pFlags[ev.excludeFlag]) return false;
                return true;
            });

            if (validEvents.length === 0) return;

            // 2. LOSOWANIE WYDARZENIA
            const ev = validEvents[Math.floor(Math.random() * validEvents.length)];

            // 3. PRZYGOTOWANIE WYSYŁKI (Sprawdzanie kosztów)
            const evToSend = JSON.parse(JSON.stringify(ev));

            evToSend.choices = evToSend.choices.map(choice => {
                let canAfford = true;
                if (choice.cost) {
                    for (let [res, amt] of Object.entries(choice.cost)) {
                        if (res === 'gold') {
                            if(player.gold < amt) canAfford = false;
                        } else {
                            // Sprawdzamy surowce (obsługa braku klucza w obiekcie)
                            const currentAmount = player.resources ? (player.resources[res] || 0) : 0;
                            if(currentAmount < amt) canAfford = false;
                        }
                    }
                }
                // Dodajemy informację dla frontendu
                return { ...choice, disabled: !canAfford };
            });

            // --- KLUCZOWA POPRAWKA: Wysyłamy evToSend, a nie ev! ---
            io.emit('random_event_triggered', evToSend);

        } catch (err) { console.error("Błąd silnika opowieści:", err); }
    }, 120000);
}

module.exports = startRandomEventsLoop;