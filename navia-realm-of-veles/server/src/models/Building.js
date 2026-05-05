const mongoose = require('mongoose');

const BuildingSchema = new mongoose.Schema({
    type: { type: String, required: true },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    storage: {
        wood_birch: { type: Number, default: 0 },
        wood_oak: { type: Number, default: 0 },
        wood_ash: { type: Number, default: 0 },
        stone: { type: Number, default: 0 },
        iron: { type: Number, default: 0 },
        herb_celandine: { type: Number, default: 0 },
        herb_wolfsbane: { type: Number, default: 0 },

        // --- NOWOŚĆ: Żywność i Skóry ---
        food: { type: Number, default: 0 },
        pelts: { type: Number, default: 0 },

        wood: { type: Number, default: 0 },
        herbs: { type: Number, default: 0 },
        maxCapacity: { type: Number, default: 100 }
    },
    upgrades: [{ type: String }],

    // --- NOWOŚĆ: SYSTEM ZNISZCZEŃ ---
    // Zapisuje stan zdrowia dla każdego wybudowanego rozszerzenia (np. 'blacksmith')
    buildingHealth: {
        type: Map,
        of: Object,
        default: {}
    }
});

module.exports = mongoose.model('Building', BuildingSchema);