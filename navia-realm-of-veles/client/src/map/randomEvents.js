// ==========================================
// --- INTERAKTYWNE WYDARZENIA LOSOWE ---
// ==========================================

// Pomocnicza funkcja UI dla Lewego Panelu
window.toggleThreatsPanel = function() {
    const panel = document.getElementById('threats-panel');
    if (panel) panel.classList.toggle('active');
};

// Zamykanie lewego panelu przy kliknięciu w tło (dopisujemy to do ogólnego systemu, jeśli trzeba)
document.addEventListener('click', (event) => {
    const isThreatsArea = event.target.closest('#threats-panel') || event.target.closest('#threats-btn');
    if (!isThreatsArea && !event.target.closest('div[id$="-modal"]')) {
        const tPanel = document.getElementById('threats-panel');
        if (tPanel) tPanel.classList.remove('active');
    }
});

// Odbieranie wydarzenia z serwera
window.socket.on('random_event_triggered', (data) => {
    // data = { id: 'evt_1', title: "...", desc: "...", icon: "...", effectsText: "...", choices: [...] }

    document.getElementById('re-title').innerText = data.title;
    document.getElementById('re-desc').innerText = data.description;

    const iconEl = document.getElementById('re-icon-img');
    if (data.icon && data.icon.includes('.png')) {
        iconEl.src = `assets/events/${data.icon}`;
        iconEl.style.display = 'inline-block';
    } else {
        iconEl.style.display = 'none'; // Ukryj obrazek, jeśli to zwykły tekst/emoji
        document.getElementById('re-title').innerHTML = `${data.icon || '📜'} ${data.title}`;
    }

    const effectsEl = document.getElementById('re-effects');
    const effectsContainer = document.getElementById('re-effects-container');

    if (data.effectsText) {
        effectsEl.innerHTML = data.effectsText;
        effectsContainer.style.display = 'block';
    } else {
        effectsContainer.style.display = 'none';
    }

    // --- GENEROWANIE DYNAMICZNYCH PRZYCISKÓW WYBORU ---
    const choicesContainer = document.getElementById('re-choices-container');
    choicesContainer.innerHTML = '';

    // Jeśli serwer przysłał listę wyborów (np. Złóż Ofiarę / Zignoruj)
    if (data.choices && data.choices.length > 0) {
        data.choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.innerHTML = `<span style="font-size: 14px; font-weight: bold;">${choice.label}</span><br><span style="font-size: 10px; color: #ddd;">${choice.costText || ''}</span>`;

            // Stylizacja przycisku (mroczny, pergaminowy)
            btn.style.cssText = `
                flex: 1; min-width: 120px; padding: 10px; cursor: pointer;
                background: url('assets/ui/btn_confirm.png') no-repeat center; background-size: 100% 100%; border: none;
                color: #f0e6d2; font-family: 'Cinzel', serif; text-shadow: 2px 2px 4px #000;
                transition: transform 0.1s, filter 0.2s;
            `;

            // Przyciemnienie jeśli gracza na to nie stać (np. brak drewna dla kupca)
            if (choice.disabled) {
                btn.style.filter = 'grayscale(1) brightness(0.6)';
                btn.style.pointerEvents = 'none';
            } else {
                btn.onmousedown = () => btn.style.transform = 'scale(0.95)';
                btn.onmouseup = () => btn.style.transform = 'scale(1.0)';
                btn.onclick = () => {
                    window.socket.emit('event_choice_made', { eventId: data.id, choiceId: choice.id });
                    document.getElementById('random-event-modal').classList.add('hidden-display');
                };
            }
            choicesContainer.appendChild(btn);
        });
    } else {
        // Zwykły, stary przycisk "Przyjmij Los", jeśli to tylko informacja
        choicesContainer.innerHTML = `
            <button onclick="document.getElementById('random-event-modal').classList.add('hidden-display')"
                style="width: 100%; height: 50px; background: url('assets/ui/btn_confirm.png') no-repeat center; background-size: 100% 100%; border: none; color: #f0e6d2; font-family: 'Cinzel', serif; font-size: 16px; font-weight: bold; text-transform: uppercase; cursor: pointer; text-shadow: 2px 2px 4px #000;">
                Przyjmij Los
            </button>
        `;
    }

    document.getElementById('random-event-modal').classList.remove('hidden-display');
});


// ==========================================
// --- LISTA AKTYWNYCH ZAGROŻEŃ (LEWY PANEL) ---
// ==========================================
window.socket.on('active_threats_updated', (threats) => {
    const list = document.getElementById('active-threats-list');
    if (!list) return;

    if (!threats || threats.length === 0) {
        list.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px; font-style:italic;">Na ziemiach Władycy panuje pokój.</div>';
        // Możesz tu ukryć przycisk zagrożeń, jeśli chcesz, żeby pojawiał się tylko, gdy jest problem!
        return;
    }

    list.innerHTML = '';
    threats.forEach(t => {
        list.innerHTML += `
            <div style="background: rgba(20, 5, 5, 0.8); border: 1px solid #ff4444; padding: 12px; border-radius: 6px; box-shadow: inset 0 0 10px rgba(255,0,0,0.2);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div style="font-size: 24px;">${t.icon || '🦇'}</div>
                    <div style="flex: 1;">
                        <b style="color: #ffaa00; font-size: 13px; text-transform: uppercase;">${t.name}</b><br>
                        <span style="font-size: 11px; color: #ff4444; font-weight: bold;">Efekt: ${t.debuffText}</span>
                    </div>
                </div>

                <p style="font-size: 10px; color: #ccc; font-style: italic; margin: 0 0 10px 0;">${t.desc}</p>

                <button onclick="postBountyToTavern('${t.id}')" style="width: 100%; background: #8b0000; color: white; border: 1px solid #d4af37; padding: 6px 10px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                    Zawieś Zlecenie w Karczmie (Nagroda: ${t.bountyCost || 100} 💰)
                </button>
            </div>
        `;
    });
});

// Funkcja wysyłająca zlecenie z panelu zagrożeń do Karczmy
window.postBountyToTavern = (threatId) => {
    // Wysyłamy prośbę na serwer o przekonwertowanie Zagrożenia na Quest w Karczmie
    window.socket.emit('post_bounty_request', { threatId: threatId });
};