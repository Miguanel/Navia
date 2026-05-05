// ==========================================
// LOGIKA KOSZAR (src/services/barracks.js)
// ==========================================

const Player = require('../models/Player');
// UWAGA: Nie importujemy Settlera, bo osadnicy "żyją" wewnątrz Gracza!

async function handleDraftRecruit(userId, settlerId, weaponId, socket) {
    try {
        // 1. Pobranie danych gracza (w obecnej wersji prototypu mamy jednego gracza)
        const player = await Player.findOne();

        if (!player) {
            return socket.emit('error_msg', { message: "Nie odnaleziono gracza." });
        }

        // 2. Szukanie konkretnego osadnika wewnątrz tablicy gracza (metoda Mongoose)
        const settler = player.settlers.id(settlerId);

        if (!settler) {
            return socket.emit('error_msg', { message: "Nie odnaleziono osadnika w Grodzie." });
        }

        if (settler.status !== 'idle') {
            return socket.emit('error_msg', { message: "Tylko bezczynny osadnik może zostać zwerbowany." });
        }

        // 3. Weryfikacja Zbrojowni
        const weaponIndex = player.armory.findIndex(w => w.id === weaponId);
        if (weaponIndex === -1) {
            return socket.emit('error_msg', { message: "Wybrany oręż nie znajduje się w Zbrojowni." });
        }

        const weapon = player.armory[weaponIndex];

        // 4. Przeniesienie broni i aktualizacja osadnika
        player.armory.splice(weaponIndex, 1);

        if (!settler.equipment) settler.equipment = { weapon: null, armor: null };
        if (!settler.proficiencies) settler.proficiencies = {};

        settler.equipment.weapon = weapon;

        // 5. Rozpoczęcie szkolenia
        const trainingTimeMs = 5 * 60 * 1000; // 5 minut
        settler.status = 'training';
        settler.trainingEndTime = Date.now() + trainingTimeMs;

        // Ważne: Mongoose musi wiedzieć, że edytowaliśmy tablice
        player.markModified('armory');
        await player.save();

        socket.emit('recruit_drafted', {
            message: `${settler.name} chwycił za ${weapon.name} i rozpoczął musztrę!`,
            settler
        });

        // 6. Asynchroniczne zakończenie szkolenia po 5 minutach
        setTimeout(async () => {
            const updatedPlayer = await Player.findOne();
            if(!updatedPlayer) return;

            const trainee = updatedPlayer.settlers.id(settlerId);

            if (trainee && trainee.status === 'training') {
                trainee.profession = 'warrior';
                trainee.status = 'idle';
                trainee.trainingEndTime = null;
                if(!trainee.exp) trainee.exp = 0;

                await updatedPlayer.save();
                console.log(`[Koszary] ${trainee.name} zakończył szkolenie!`);
            }
        }, trainingTimeMs);

    } catch (err) {
        console.error("Błąd w Koszarach:", err);
        socket.emit('error_msg', { message: "Koszary napotkały problem." });
    }
}

module.exports = { handleDraftRecruit };