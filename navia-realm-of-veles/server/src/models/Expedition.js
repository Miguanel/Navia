const mongoose = require('mongoose');

const ExpeditionSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    target: { type: String, default: 'forest' },
    mission: { type: String, default: 'gather' },
    status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
    startTime: { type: Date, default: Date.now },
    durationMs: { type: Number, default: 60000 },

    // Zapisujemy konkretne ID osadników, którzy wyruszyli
    settlerIds: [{ type: String }],
    crew: {
        woodcutters: { type: Number, default: 0 },
        herbalists: { type: Number, default: 0 },
        warriors: { type: Number, default: 0 }
    },

    events: [{ type: String }],
    loot: {
        wood: { type: Number, default: 0 },
        gold: { type: Number, default: 0 },
        food: { type: Number, default: 0 },
        herbs: { type: Number, default: 0 },
        pelts: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('Expedition', ExpeditionSchema);