const mongoose = require('mongoose');

const CaravanSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    status: { type: String, default: 'en_route', enum: ['en_route', 'camped', 'attacked', 'arrived'] },
    inventory: {
        sand: { type: Number, default: 0 },
        glass: { type: Number, default: 0 },
        wood: { type: Number, default: 0 }
    },
    route: [[Number]], // Tablica koordynatów [lat, lng] od początku do końca trasy
    currentRouteIndex: { type: Number, default: 0 },
    protocols: {
        on_night: { type: String, default: 'camp' }, // 'camp' lub 'travel'
        on_attack: { type: String, default: 'fight' } // 'fight', 'flee', 'bribe'
    },
    escort: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NPC' }] // ID najemników/strażników
}, { timestamps: true });

module.exports = mongoose.model('Caravan', CaravanSchema);