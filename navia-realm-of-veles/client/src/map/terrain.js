

let terrainLayer = null;

// Funkcja nadająca kolory poszczególnym strefom
function getTerrainStyle(feature) {
    const tags = feature.properties || {}; // Tagi przeniesione z OpenStreetMap

    // Zmienna pomocnicza do przypisania klasy filtru
    let filterClass = "filter-other";

    // 1. WODA (Rzeki, Jeziora, Stawy)
    if (tags.waterway === 'river' || tags.water || tags.natural === 'water') {
        return {
            color: '#4682b4', weight: 3, fillColor: '#4682b4', fillOpacity: 0.6,
            className: 'filter-layer filter-water'
        };
    }
    // 2. LASY
    if (tags.natural === 'wood' || tags.landuse === 'forest') {
        return {
            color: '#228b22', weight: 1, fillColor: '#006400', fillOpacity: 0.5,
            className: 'filter-layer filter-forest'
        };
    }
    // 3. BAGNA I MOKRADŁA (Mroczna zieleń)
    if (tags.natural === 'wetland') {
        return {
            color: '#2f4f4f', weight: 1, fillColor: '#556b2f', fillOpacity: 0.6, dashArray: '4',
            className: 'filter-layer filter-meadow' // Przypisane do łąk/natury
        };
    }
    // 4. SKAŁY I URWISKA (Szare)
    if (tags.natural === 'bare_rock' || tags.natural === 'cliff') {
        return {
            color: '#555555', weight: 2, fillColor: '#808080', fillOpacity: 0.7,
            className: 'filter-layer filter-other'
        };
    }
    // 5. ŁĄKI I PASTWISKA (Jasna zieleń)
    if (tags.landuse === 'meadow' || tags.landuse === 'grass' || tags.natural === 'grassland') {
        return {
            color: '#9acd32', weight: 1, fillColor: '#adff2f', fillOpacity: 0.3,
            className: 'filter-layer filter-meadow'
        };
    }
    // 6. TERENY PIASZCZYSTE (Wydmy/Plaże)
    if (tags.natural === 'sand') {
        return {
            color: '#d2b48c', weight: 1, fillColor: '#f5deb3', fillOpacity: 0.5,
            className: 'filter-layer filter-meadow'
        };
    }
    // 7. SADY I OGRODY (Wyraźna zielona obwódka)
    if (tags.landuse === 'orchard' || tags.leisure === 'garden') {
        return {
            color: '#32cd32', weight: 2, fillColor: '#90ee90', fillOpacity: 0.4,
            className: 'filter-layer filter-forest'
        };
    }
    // 8. KURHANY I MOGIŁY (Mroczna czerwień i fiolet)
    if (tags.historic === 'archaeological_site' || tags.historic === 'tomb') {
        return {
            color: 'transparent', // Zdejmujemy obramowanie granicy
            weight: 0,
            fillColor: '#483d8b',
            fillOpacity: 0.3, // Tylko delikatny cień na ziemi
            dashArray: null,
            className: 'filter-layer filter-shrine'
        };
    }
    // 9. ŚWIĘTE ŹRÓDŁA I MIEJSCA KULTU (Złota poświata)
    if (tags.amenity === 'place_of_worship' || tags.natural === 'spring') {
        return {
            color: 'transparent', // Zdejmujemy obramowanie granicy
            weight: 0,
            fillColor: '#ffdf00',
            fillOpacity: 0.3, // Tylko delikatny cień na ziemi
            dashArray: null,
            className: 'filter-layer filter-shrine'
        };
    }

    // Dla budynków (jeśli dodasz je do query OSM)
    if (tags.building) {
        return {
            color: '#444', weight: 1, fillColor: '#777', fillOpacity: 0.7,
            className: 'filter-layer filter-building'
        };
    }

    return { color: '#aaaaaa', weight: 1, fillOpacity: 0.2, className: 'filter-layer filter-other' };
}

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('filter-check')) {
        const type = e.target.getAttribute('data-type');
        const isVisible = e.target.checked;

        // Ukrywamy tylko grafikę na mapie
        const mapElements = document.querySelectorAll(`.filter-${type}`);
        mapElements.forEach(el => {
            el.style.opacity = isVisible ? "1" : "0"; // Używamy opacity zamiast display:none dla płynności
            el.style.pointerEvents = isVisible ? "auto" : "none";
        });
    }
});

// funkcja ładowania terenu czyściła i wypełniała te listy
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-list')) {
        const list = e.target.parentElement.nextElementSibling;
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'block' : 'none';
        e.target.innerText = isHidden ? '▲' : '▼';
    }
});

// Funkcja dodająca ikony dla miejsc punktowych (np. pojedynczy kurhan, nie cały obszar)
function pointToLayer(feature, latlng) {
    const tags = feature.properties || {};
    let iconHtml = '📍'; // Domyślny
    let color = "#ffffff";

    if (tags.historic === 'wayside_shrine') {
        iconHtml = '⛩️'; // Kapliczka
        color = "#ffd700";
    } else if (tags.historic === 'archaeological_site' || tags.historic === 'tomb') {
        iconHtml = '🪦'; // Kurhan
        color = "#ff4444";
    } else if (tags.amenity === 'artwork' || tags.historic === 'monument') {
        iconHtml = '🗿'; // Posąg / Monument
        color = "#00ffff";
    } else if (tags.natural === 'spring' || tags.amenity === 'place_of_worship') {
        iconHtml = '✨'; // Miejsce Kultu / Źródło
        color = "#00ff00";
    } else if (tags.natural === 'stone') {
        iconHtml = '💎'; // Magiczny Głaz
        color = "#aaaaff";
    }

    return L.marker(latlng, {
        icon: L.divIcon({
            html: `<div style="font-size:20px; filter:drop-shadow(0 0 5px ${color});">${iconHtml}</div>`,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).bindPopup(`<b>Wyjątkowe Miejsce</b><br>${tags.name || "Tajemniczy obiekt"}`);
}

window.renderTerrainOnMap = function() {
    // 1. Czyścimy stary teren i stare aury
    if (terrainLayer) window.map.removeLayer(terrainLayer);
    if (window.magicAurasLayer) window.map.removeLayer(window.magicAurasLayer);

    // Tworzymy nową grupę na aury, aby łatwo je usuwać
    window.magicAurasLayer = L.layerGroup().addTo(window.map);

    const allFeatures = [];
    if (window.gameTerrain.forestsGeoJSON) allFeatures.push(...window.gameTerrain.forestsGeoJSON.features);
    if (window.gameTerrain.waterGeoJSON) allFeatures.push(...window.gameTerrain.waterGeoJSON.features);
    if (window.gameTerrain.otherGeoJSON) allFeatures.push(...window.gameTerrain.otherGeoJSON.features);

    if (allFeatures.length > 0) {
        terrainLayer = L.geoJSON(turf.featureCollection(allFeatures), {
            style: getTerrainStyle,
            pointToLayer: pointToLayer,

            onEachFeature: (feature, layer) => {
                const tags = feature.properties || {};

                // --- RYSOWANIE WIZUALNEJ AURY ---
                // --- RYSOWANIE WIZUALNEJ AURY ---
                // --- RYSOWANIE WIZUALNEJ AURY ---
                const isMagicSource = tags.historic || tags.amenity === 'place_of_worship' || tags.natural === 'spring' || tags.natural === 'stone';

                if (isMagicSource && feature.geometry) {
                    let centerLatLng;

                    if (feature.geometry.type === 'Point') {
                        centerLatLng = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    } else {
                        const center = turf.centroid(feature);
                        centerLatLng = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
                    }

                    // --- 1. ROZPOZNAWANIE TYPU I KOLORU MAGII ---
                    let auraColor = '#ffcc00'; // Domyślny Złoty
                    let magicType = 'holy';

                    if (tags.historic === 'tomb' || tags.historic === 'archaeological_site' || tags.historic === 'ruins') {
                        auraColor = '#8b008b'; // Mroczny fiolet
                        magicType = 'cursed';
                    } else if (tags.natural === 'spring' || tags.waterway === 'waterfall') {
                        auraColor = '#32cd32'; // Jasna zieleń
                        magicType = 'healing';
                    } else if (tags.natural === 'stone' || tags.historic === 'monument') {
                        auraColor = '#00ffff'; // Błękitny
                        magicType = 'mystic';
                    }

                    // --- 2. OBLICZANIE POTĘGI (ZASIĘGU) MIEJSCA MOCY ---
                    let powerMultiplier = 1.0;

                    // A. Ranga obiektu
                    if (tags.historic === 'wayside_shrine' || tags.natural === 'stone' || tags.natural === 'spring') {
                        powerMultiplier = 0.5; // Małe obiekty (Promień x 0.5)
                    } else if (tags.historic === 'archaeological_site' || tags.historic === 'ruins' || tags.historic === 'castle') {
                        powerMultiplier = 2.0; // Starożytne ruiny i grodziska (Promień x 2)
                    } else if (tags.amenity === 'place_of_worship') {
                        powerMultiplier = 1.2; // Główne świątynie/kościoły
                    }

                    // B. Znaczenie kulturowe (Sława)
                    if (tags.wikipedia || tags.wikidata || tags.tourism === 'attraction') {
                        powerMultiplier += 0.8; // Legendarne miejsca dostają ogromny bonus!
                    }

                    // C. Fizyczna wielkość (tylko dla obszarów)
                    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                        const areaSqMeters = turf.area(feature);
                        if (areaSqMeters > 10000) powerMultiplier += 1.0; // Gigantyczne kompleksy
                        else if (areaSqMeters > 2000) powerMultiplier += 0.5; // Średnie cmentarze
                    }

                    // Obliczenie ostatecznego promienia (Bazowo: 400 metrów)
                    let finalRadius = Math.floor(400 * powerMultiplier);

                    // Zabezpieczenie: Zasięg nie może być mniejszy niż 150m i większy niż 2km
                    if (finalRadius < 150) finalRadius = 150;
                    if (finalRadius > 2000) finalRadius = 2000;

                    // --- 3. RYSOWANIE OKRĘGU ---
                    const auraCircle = L.circle(centerLatLng, {
                        radius: finalRadius,   // UŻYWAMY NASZEGO WYLICZONEGO PROMIENIA!
                        stroke: false,
                        fillColor: auraColor,
                        fillOpacity: 0.3,
                        className: 'magic-aura',
                        interactive: false
                    }).addTo(window.magicAurasLayer);

                    // Zapisujemy parametry do logiki gry (przyda się przy systemie wydarzeń!)
                    auraCircle.magicInfo = {
                        type: magicType,
                        power: powerMultiplier,
                        radius: finalRadius
                    };
                }

                // --- REAKCJA NA KLIKNIĘCIE W TEREN ---
                layer.on('click', (e) => {
                    const tags = feature.properties || {};
                    let type = 'other';

                    // Rozbudowane rozpoznawanie terenów do Księgi
                    if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.landuse === 'orchard') type = 'forest';
                    else if (tags.natural === 'wetland') type = 'swamp';
                    else if (tags.natural === 'water' || tags.waterway || tags.water === 'lake') type = 'water';
                    else if (tags.landuse === 'meadow' || tags.landuse === 'grass' || tags.natural === 'grassland') type = 'meadow';
                    else if (tags.natural === 'bare_rock' || tags.natural === 'cliff') type = 'rock';
                    else if (tags.natural === 'sand') type = 'sand';
                    else if (tags.historic || tags.amenity === 'place_of_worship' || tags.natural === 'spring' || tags.natural === 'stone') type = 'shrine';

                    const isMagicNearby = checkMagicProximity(e.latlng);
                    const area = (feature.geometry && feature.geometry.type === 'Polygon') ? turf.area(feature) : 0;

                    const desc = window.getSlavicDescription(type, area, tags);
                    const events = getEventChances(type, isMagicNearby);

                    if (typeof window.showTerrainModal === 'function') {
                        // Przekazujemy również typ terenu (przydatne później do serwera)
                        window.showTerrainModal(tags.name || "Nieodkryte ziemie", desc, events, e.latlng, type);
                    }

                    L.DomEvent.stopPropagation(e);
                });
            }
        }).addTo(window.map);
    }
}

window.checkMagicProximity = function(clickLatLng) {
    let magicDetected = false;

    // Szukamy w "worku" innych obiektów (tam trzymasz Kapliczki i Kurhany)
    if (window.gameTerrain.otherGeoJSON && window.gameTerrain.otherGeoJSON.features) {
        window.gameTerrain.otherGeoJSON.features.forEach(feature => {
            const tags = feature.properties || {};

            // Definicja obiektów emanujących magią
            const isMagicSource = tags.historic ||
                                  tags.amenity === 'place_of_worship' ||
                                  tags.natural === 'spring' ||
                                  tags.natural === 'stone';

            if (isMagicSource && feature.geometry) {
                let sourceCoords;

                // Pobieramy koordynaty niezależnie czy to Punkt czy Poligon (np. Ruiny)
                if (feature.geometry.type === 'Point') {
                    sourceCoords = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                } else {
                    // Dla obszarów bierzemy środek geometryczny (Centroid)
                    const center = turf.centroid(feature);
                    sourceCoords = [center.geometry.coordinates[1], center.geometry.coordinates[0]];
                }

                const dist = window.map.distance(clickLatLng, sourceCoords);
                if (dist < 500) { // Zasięg aury: 500 metrów
                    magicDetected = true;
                }
            }
        });
    }
    return magicDetected;
}

function renderMagicAura(lat, lng) {
    // Gradientowy krąg emanacji (zasięg 500m)
    L.circle([lat, lng], {
        radius: 500,           // zostaw swój obecny promień
        color: '#ffcc00',
        fillColor: '#ffaa00',
        fillOpacity: 0.2,
        weight: 3,
        dashArray: null,       // To usuwa przerywane linie!
        className: 'magic-aura' // To podpina Twoją nową animację z index.html!
    }).addTo(window.map);
}

window.loadRealTerrain = async function(lat, lng) {
    const now = Date.now();

    // 1. Sprawdzenie czasu i dystansu (throttling)
    if (now - window.gameTerrain.lastFetchTime < 30000 && !window.gameTerrain.forestsGeoJSON) return;
    if (window.gameTerrain.lastFetchCoords) {
        const distFromLastFetch = window.map.distance([lat, lng], window.gameTerrain.lastFetchCoords);
        if (distFromLastFetch < 500) return;
    }

    // 2. Bezpieczna obsługa Cache (Naprawiony błąd logów)
    const rawCache = localStorage.getItem('navia_terrain_cache');
    if (rawCache) {
        try {
            const cachedTerrain = JSON.parse(rawCache);
            if (cachedTerrain && cachedTerrain.center) {
                const distFromCache = map.distance([lat, lng], cachedTerrain.center);
                if (distFromCache < 500 && !window.gameTerrain.forestsGeoJSON) {
                    console.log("📜 Odczytano mapy z dawnych zwojów (Cache)...");
                    window.gameTerrain.forestsGeoJSON = turf.featureCollection(cachedTerrain.forests);
                    window.gameTerrain.waterGeoJSON = turf.featureCollection(cachedTerrain.water);
                    window.gameTerrain.otherGeoJSON = turf.featureCollection(cachedTerrain.other || []);
                    window.gameTerrain.lastFetchCoords = cachedTerrain.center;

                    renderTerrainOnMap();
                    // Opcjonalnie wywołaj funkcję odświeżającą legendę z cache tutaj
                    return;
                }
            }
        } catch(e) {
            console.warn("Stary zwój z mapą zbutwiał. Pobieram nową wiedzę.");
            localStorage.removeItem('navia_terrain_cache');
        }
    }

    window.gameTerrain.lastFetchTime = now;
    console.log("🌍 Pobieranie nowych danych terenu z OSM...");

    const bbox = `${lat - 0.015},${lng - 0.02},${lat + 0.015},${lng + 0.02}`;

    // Wydłużamy timeout z 15 do 25 sekund, by dać serwerom więcej czasu
    const query = `
        [out:json][timeout:25];
        (
          way["landuse"="forest"](${bbox});
          way["natural"="wood"](${bbox});
          way["natural"="water"](${bbox});
          way["waterway"="river"](${bbox});
          way["natural"="bare_rock"](${bbox});
          way["natural"="cliff"](${bbox});
          way["natural"="wetland"](${bbox});
          way["water"="lake"](${bbox});
          way["water"="pond"](${bbox});
          way["landuse"="meadow"](${bbox});
          way["landuse"="grass"](${bbox});
          way["natural"="grassland"](${bbox});
          way["natural"="sand"](${bbox});
          way["landuse"="orchard"](${bbox});
          way["leisure"="garden"](${bbox});
          node["historic"](${bbox});
          way["historic"](${bbox});
          node["amenity"="place_of_worship"](${bbox});
          way["amenity"="place_of_worship"](${bbox});
          node["natural"="spring"](${bbox});
          node["amenity"="artwork"](${bbox});
          node["natural"="stone"](${bbox});
        );
        out geom;
    `;

    // Lista serwerów publicznych (główny i zapasowe)
    const overpassEndpoints = [
        "https://overpass-api.de/api/interpreter",         // Główny (najczęściej przeciążony)
        "https://lz4.overpass-api.de/api/interpreter",     // Alternatywny węzeł
        "https://overpass.kumi.systems/api/interpreter"    // Zupełnie inny serwer społeczności
    ];

    let data = null;
    let fetchSuccess = false;

    // Próbujemy po kolei uderzać do różnych serwerów
    for (let endpoint of overpassEndpoints) {
        try {
            console.log(`📡 Pytam zwiadowców z: ${endpoint}...`);
            const url = `${endpoint}?data=${encodeURIComponent(query)}`;
            const res = await fetch(url);

            if (res.ok) {
                data = await res.json();
                fetchSuccess = true;
                break; // Sukces! Przerywamy pętlę i nie pytamy kolejnych serwerów
            } else {
                console.warn(`⚠️ Serwer ${endpoint} zwrócił błąd: ${res.status}`);
            }
        } catch (err) {
            console.warn(`⚠️ Serwer ${endpoint} nie odpowiada.`);
        }
    }

    if (!fetchSuccess || !data) {
        console.error("❌ Wszystkie serwery Overpass są przeciążone. Spróbuj ponownie za chwilę.");
        // Opcjonalnie: możemy tu wyświetlić graczowi komunikat z interfejsu
        return;
    }

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Błąd: ${res.status}`);

        const data = await res.json();
        const forestFeatures = [];
        const waterFeatures = [];
        const otherFeatures = [];

        // --- PRZYGOTOWANIE LICZNIKÓW I LIST DLA LEGENDY ---
        const counts = { water: 0, forest: 0, shrine: 0 };
        const lists = {
            water: document.getElementById('list-water'),
            forest: document.getElementById('list-forest'),
            shrine: document.getElementById('list-shrine')
        };

        // Czyścimy stare listy w UI
        Object.values(lists).forEach(list => { if(list) list.innerHTML = ''; });

        data.elements.forEach(el => {
            const tags = el.tags || {};
            let feature = null;

            // Konwersja danych OSM na GeoJSON (Turf.js)
            if (el.type === 'node') {
                feature = turf.point([el.lon, el.lat], tags);
            } else if (el.geometry) {
                const coords = el.geometry.map(g => [g.lon, g.lat]);
                const isPolygon = coords.length > 3 && coords[0][0] === coords[coords.length-1][0] && coords[0][1] === coords[coords.length-1][1];
                try {
                    feature = isPolygon ? turf.polygon([coords], tags) : turf.lineString(coords, tags);
                } catch(e) { return; } // Pomiń błędne geometrie
            }

            if (!feature) return;

            // --- LOGIKA SEGREGACJI ---
            let type = 'other';
            if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.landuse === 'orchard') {
                forestFeatures.push(feature);
                type = 'forest';
            } else if (tags.natural === 'water' || tags.waterway || tags.water || tags.natural === 'wetland') {
                waterFeatures.push(feature);
                type = 'water';
            } else {
                otherFeatures.push(feature);
                // Rozpoznawanie Miejsc Mocy dla legendy
                if (tags.historic || tags.amenity === 'place_of_worship' || tags.natural === 'spring' || tags.natural === 'stone') {
                    type = 'shrine';
                }
            }

            // --- AKTUALIZACJA WIZUALNA LEGENDY ---
            if (counts[type] !== undefined && lists[type]) {
                counts[type]++;

                const area = feature.geometry.type === 'Polygon' ? turf.area(feature) : 0;
                const desc = getSlavicDescription(type, area, tags);
                const name = tags.name || (type === 'shrine' ? "Miejsce bez miana" : "Uroczysko");

                const li = document.createElement('li');
                li.style.cssText = "border-bottom: 1px solid #4a3c2a; padding: 8px 0; cursor: help; list-style: none;";
                li.innerHTML = `
                    <div style="color: #d4af37; font-weight: bold; font-size: 12px;">• ${name}</div>
                    <div style="color: #8c7d6b; font-style: italic; font-size: 10px; line-height: 1.2;">"${desc}"</div>
                `;

                li.onmouseenter = () => { li.style.background = "rgba(212, 175, 55, 0.1)"; };
                li.onmouseleave = () => { li.style.background = "transparent"; };

                lists[type].appendChild(li);
            }
        });

        // Aktualizacja liczb w legendzie
        if (document.getElementById('count-water')) document.getElementById('count-water').innerText = `(${counts.water})`;
        if (document.getElementById('count-forest')) document.getElementById('count-forest').innerText = `(${counts.forest})`;
        if (document.getElementById('count-shrine')) document.getElementById('count-shrine').innerText = `(${counts.shrine})`;

        // Przypisanie do stanów gry
        window.gameTerrain.forestsGeoJSON = turf.featureCollection(forestFeatures);
        window.gameTerrain.waterGeoJSON = turf.featureCollection(waterFeatures);
        window.gameTerrain.otherGeoJSON = turf.featureCollection(otherFeatures);
        window.gameTerrain.lastFetchCoords = [lat, lng];

        // Zapis do Cache
        localStorage.setItem('navia_terrain_cache', JSON.stringify({
            center: [lat, lng],
            forests: forestFeatures,
            water: waterFeatures,
            other: otherFeatures
        }));

        renderTerrainOnMap();
        console.log("🌲 Teren i zwiady zaktualizowane pomyślnie!");

    } catch (e) {
        console.error("❌ Błąd pobierania terenu:", e.message);
    }
}

// Obsługa rozwijania detali w panelu zwiadu
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('toggle-list')) {
        const group = e.target.closest('.legend-group');
        const list = group.querySelector('ul');
        if (list.style.display === 'none') {
            list.style.display = 'block';
            e.target.innerText = '▲';
        } else {
            list.style.display = 'none';
            e.target.innerText = '▼';
        }
    }
});

