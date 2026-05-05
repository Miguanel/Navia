window.socket.on('time_updated', (data) => {
    // 1. Ustawianie odpowiedniej Ikony i Koloru Pory Roku
    const seasonIcons = { 'Wiosna': '🌱', 'Lato': '☀️', 'Jesień': '🍂', 'Zima': '❄️' };
    const seasonColors = { 'Wiosna': '#32cd32', 'Lato': '#ffaa00', 'Jesień': '#d2b48c', 'Zima': '#add8e6' };

    // 2. Cykl Dnia i Nocy
    let timeIcon = '☀️'; // Dzień
    if (!data.isDaylight) timeIcon = '🌙'; // Noc

    // 3. Aktualizacja tekstów na ekranie
    document.getElementById('hud-season-text').innerText = `${seasonIcons[data.season]} ${data.season}, Rok ${data.year}`;
    document.getElementById('hud-season-text').style.color = seasonColors[data.season] || '#d4af37';
    document.getElementById('hud-day-text').innerText = `Dzień ${data.day}/14`;

    document.getElementById('hud-clock').innerText = data.time;
    document.getElementById('hud-time-icon').innerText = timeIcon;

    // 4. Subtelna zmiana tła panelu w zależności od Dnia/Nocy
    const timePanel = document.getElementById('hud-time-panel');
    if (data.isDaylight) {
        timePanel.style.borderColor = '#d4af37'; // Złota obwódka za dnia
        timePanel.style.boxShadow = '0 0 15px rgba(212, 175, 55, 0.2)';
    } else {
        timePanel.style.borderColor = '#1a1a50'; // Granatowa obwódka w nocy
        timePanel.style.boxShadow = '0 0 15px rgba(0, 0, 50, 0.5)';
        document.getElementById('hud-clock').style.color = '#87cefa'; // Jasnoniebieski zegar w nocy
    }
});