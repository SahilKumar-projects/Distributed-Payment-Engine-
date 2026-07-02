// src/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    idempotencyKey: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true // Index this so customer support can search it instantly
    },
    status: { type: String, required: true },
    receipt: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);