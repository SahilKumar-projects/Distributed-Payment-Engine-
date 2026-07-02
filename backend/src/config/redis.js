const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis(process.env.REDIS_URL, {
    retryStrategy: (times) => {
        // Reconnect after a delay if Redis goes down
        return Math.min(times * 50, 2000);
    }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis Cache'));

module.exports = redisClient;