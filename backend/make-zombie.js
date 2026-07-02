const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL);

const injectZombie = async () => {
    const key = 'idempotency:pay:zombie_test_1';
    
    // We set the 'startedAt' to an old timestamp from the year 2023
    // This makes the lock look like it has been stuck for months.
    await redis.hset(key, {
        status: 'PROCESSING',
        startedAt: 1700000000000 
    });

    console.log(`🧟 Zombie lock successfully injected into Redis at key: ${key}`);
    process.exit(0);
};

injectZombie();