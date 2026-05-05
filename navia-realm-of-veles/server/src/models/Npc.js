const mongoose = require('mongoose');

const NPCSchema = new mongoose.Schema({
    name: { type: String, required: true },
    role: {
        type: String,
        enum: ['caravan'], // Tylko wozy poruszają się po świecie
        required: true
    },
    location: { lat: Number, lng: Number },
    status: {
        type: String,
        enum: ['idle', 'collecting', 'delivering', 'walking'],
        default: 'idle'
    }
}, { timestamps: true });

module.exports = mongoose.model('NPC', NPCSchema);