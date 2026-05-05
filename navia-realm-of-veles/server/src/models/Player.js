const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    gold: { type: Number, default: 11000 },
    houses: { type: Number, default: 0 },
    resources: {
        wood_birch: { type: Number, default: 200 },
        wood_oak: { type: Number, default: 100 },
        wood_ash: { type: Number, default: 50 },
        stone: { type: Number, default: 300 },
        iron: { type: Number, default: 100 },
        herb_celandine: { type: Number, default: 50 },
        herb_wolfsbane: { type: Number, default: 50 },
        wpn_sword: { type: Number, default: 5 },
        wpn_axe: { type: Number, default: 5 },
        wpn_bow: { type: Number, default: 5 },
        wpn_spear: { type: Number, default: 5 },
        shd_wood: { type: Number, default: 5 },
        shd_iron: { type: Number, default: 5 },
        pot_heal: { type: Number, default: 5 },
        pot_poison: { type: Number, default: 5 },
        food: { type: Number, default: 500 },
        pelts: { type: Number, default: 0 }
    },
    crew: {
        woodcutters: { type: Number, default: 0 },
        herbalists: { type: Number, default: 0 },
        warriors: { type: Number, default: 0 }
    },
    armory: { type: Array, default: [] },
    settlers: [{
        name: { type: String },
        profession: { type: String, enum: ['peasant', 'woodcutter', 'herbalist', 'warrior', 'miner', 'blacksmith', 'hunter', 'farmer'] },
        trait: { type: String },
        exp: { type: Number, default: 0 },
        status: { type: String, enum: ['idle', 'expedition', 'working', 'walking_to_work', 'returning_home', 'resting', 'training', 'questing'], default: 'idle' },
        workplaceId: { type: String, default: null },
        equipment: { type: Object, default: { weapon: null, armor: null } },
        proficiencies: { type: Object, default: {} },
        trainingEndTime: { type: Number, default: null }
    }],

    // ==========================================
    // --- NOWOŚĆ: SYSTEM OPOWIEŚCI I ZAGROŻEŃ ---
    // ==========================================

    // Zapamiętuje wybory gracza (np. { "refused_gods": true }) by uruchomić zemstę w przyszłości
    eventFlags: { type: Map, of: Boolean, default: {} },

    // Lista bestii i klątw dręczących miasto (wysuwa się z lewej strony ekranu)
    activeThreats: { type: Array, default: [] },

    // Lista zleceń dostępna dla Wojowników w Karczmie
    tavernQuests: { type: Array, default: [] }
});

module.exports = mongoose.model('Player', PlayerSchema);