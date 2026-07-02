const express = require('express');
const cors = require('cors');
const paymentController = require('./controllers/payment.controller');
const paymentRateLimiter = require('./middlewares/rateLimiter'); // 1. Import the shield

const app = express();

app.use(cors());
app.use(express.json()); // Parse JSON bodies

// 2. Inject the shield right before the controller
app.post(
    '/api/v1/payments', 
    paymentRateLimiter,         // LAYER 1: The IP Shield (Blocks Botnets)
    paymentController.processPayment   // LAYER 2: The Idempotency Engine (Blocks Double-Clicks)
);

module.exports = app;