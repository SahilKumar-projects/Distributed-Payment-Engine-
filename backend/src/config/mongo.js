// src/config/mongo.js
const mongoose = require('mongoose');

const connectMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB Permanent Ledger');
    } catch (error) {
        console.error('[FATAL] MongoDB connection failed:', error);
        process.exit(1); // Stop the app if the DB is down
    }
};

module.exports = connectMongo;