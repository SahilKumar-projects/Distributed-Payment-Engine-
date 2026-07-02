// src/middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redis');

// Create a rate limiter that uses our Upstash Redis cluster to track IPs
const paymentRateLimiter = rateLimit({
    store: new RedisStore({
        // This tells the library how to talk to our specific ioredis setup
        sendCommand: (...args) => redisClient.call(...args),
    }),
    windowMs: 60 * 1000, // 1 minute time window
    max: 3, // MAXIMUM 3 requests per minute per IP address
    message: { error: '429 Too Many Requests: Bot behavior detected. Please slow down.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = paymentRateLimiter;