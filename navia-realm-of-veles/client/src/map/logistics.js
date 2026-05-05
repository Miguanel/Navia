// ==========================================
// --- RYSOWANIE I RUCH KARAWAN ---
// ==========================================
function drawNpcOnMap(npc) {
    if (!npc || npc.role !== 'caravan') return;
    const icon = L.divIcon({ html: `<div style="font-size:25px; text-shadow:0 0 5px #000;">🐎</div>`, className: 'caravan', iconSize: [30,30], iconAnchor: [15,15] });
    if (window.npcMarkers[npc._id]) window.map.removeLayer(window.npcMarkers[npc._id]);
    window.npcMarkers[npc._id] = L.marker([npc.location.lat, npc.location.lng], { icon, zIndexOffset: 1000 }).addTo(window.map);
}

function walkTo(npcId, targetLat, targetLng, durationMs = 5000) {
    const marker = window.npcMarkers[npcId];
    if (!marker) return;
    if (marker.moveInterval) clearInterval(marker.moveInterval);

    // --- MODYFIKATOR PRĘDKOŚCI (ZMARA) ---
    // Pobieramy aktywne zagrożenia z pamięci globalnej (zakładamy, że serwer je tam wysyła)
    const activeThreats = window.activeThreats || [];
    let speedPenalty = 1.0;

    // Sprawdzamy czy ID Zmary znajduje się w liście zagrożeń
    if (activeThreats.some(t => t.id === 'wraith_threat_1')) {
        speedPenalty = 1.4; // Zwiększamy czas podróży o 40% (czyli spowalniamy o ok. 30%)
    }

    const start = marker.getLatLng();
    const stepMs = 50;

    // Obliczamy zmodyfikowany czas trwania
    const finalDuration = durationMs * speedPenalty;
    const progressPerStep = stepMs / finalDuration;
    // -------------------------------------

    let progress = 0;

    marker.moveInterval = setInterval(() => {
        progress += progressPerStep;
        if (progress >= 1) progress = 1;

        marker.setLatLng([
            start.lat + (targetLat - start.lat) * progress,
            start.lng + (targetLng - start.lng) * progress
        ]);

        if (progress === 1) {
            clearInterval(marker.moveInterval);
        }
    }, stepMs);
}

window.socket.on('npc_activity', (data) => {
    if (data.action === 'collecting' || data.action === 'delivering') {
        // Przekazujemy podany przez serwer czas animacji (data.duration)
        walkTo(data.npcId, data.target.lat, data.target.lng, data.duration);
    }
});
