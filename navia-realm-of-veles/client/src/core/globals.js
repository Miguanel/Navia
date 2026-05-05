// --- MOSTEK ZMIENNYCH GLOBALNYCH ---
const map = window.map;
const socket = window.socket;
let playerMarker = window.playerMarker;
let domainCircle = window.domainCircle;
let npcMarkers = window.npcMarkers;
let buildingMarkers = window.buildingMarkers;

// -----------------------------------


// ==========================================
// --- RDZEŃ GRY (ZMIENNE GLOBALNE) ---
// ==========================================

// Inicjalizacja Mapy i Serwera (teraz otwarte dla wszystkich plików!)
window.map = L.map('map').setView([49.972, 18.388], 15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(window.map);

window.socket = io("http://localhost:3000");

// Znaczniki i obiekty na mapie
window.playerMarker = null;
window.domainCircle = null;
window.npcMarkers = {};
window.buildingMarkers = {};
window.currentActiveCityId = null;
window.activeThreats = []; // Tu będą lądować dane o potworach

// Globalna pamięć przeglądarki
window.myHouses = window.myHouses || 0;
window.mySettlers = window.mySettlers || [];
window.gameLogs = [];

window.gameTerrain = {
    forestsGeoJSON: null,
    waterGeoJSON: null,
    otherGeoJSON: null,
    lastFetchCoords: null,
    lastFetchTime: 0
};

// Warstwa na świetliste Aury wokół Miejsc Mocy
window.magicAurasLayer = L.layerGroup().addTo(window.map);