const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("🌑 Nawia połączona z bazą danych Welesa.");
    } catch (err) {
        console.error("Błąd połączenia z otchłanią:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;