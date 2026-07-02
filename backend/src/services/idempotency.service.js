const redis = require('../config/redis');
const Transaction = require('../models/Transaction');

// Set keys to expire after 24 hours (86400 seconds)
const TTL_SECONDS = 86400; 

// 1. Check the current state of a transaction
const getTransactionState = async (idempotencyKey) => {
    const key = `idempotency:pay:${idempotencyKey}`;
    const record = await redis.hgetall(key);
    
    if (Object.keys(record).length === 0) {
        return null; // Key doesn't exist (Clean Hit)
    }
    return record; 
};

// 2. Attempt to atomically lock a new transaction
const tryAcquireLock = async (idempotencyKey) => {
    const key = `idempotency:pay:${idempotencyKey}`;
    
    // ATOMIC OPERATION: Set status to PROCESSING *only* if status doesn't exist yet.
    const isNew = await redis.hsetnx(key, 'status', 'PROCESSING');
    
    if (isNew === 1) {
        // We successfully acquired the lock! Now set the metadata.
        await redis.hset(key, 'startedAt', Date.now());
        await redis.expire(key, TTL_SECONDS);
        return true;
    }
    
    // Someone else beat us to it by a millisecond.
    return false; 
};

// 3. Forcefully overwrite a stuck "Zombie" lock
const forceAcquireLock = async (idempotencyKey) => {
    const key = `idempotency:pay:${idempotencyKey}`;
    
    // We use HSET instead of HSETNX to forcefully overwrite the existing stuck state
    await redis.hset(key, {
        status: 'PROCESSING',
        startedAt: Date.now()
    });
    // Reset the 24-hour expiration
    await redis.expire(key, TTL_SECONDS);
};

// 4. Save the receipt to BOTH databases (Dual-Write)
const saveCompletedTransaction = async (idempotencyKey, httpCode, responseBody) => {
    const key = `idempotency:pay:${idempotencyKey}`;
    
    // Phase 1: Save to Redis (Fast, short-term lock for 24 hours)
    await redis.hset(key, {
        status: 'COMPLETED',
        httpCode: httpCode,
        responseBody: JSON.stringify(responseBody)
    });

    // Phase 2: The Fire-and-Forget MongoDB Write (Permanent Ledger)
    Transaction.create({
        idempotencyKey: idempotencyKey,
        status: 'COMPLETED',
        receipt: responseBody
    }).catch(err => {
        // If Mongo fails, we log it, but the user still gets their checkout success
        console.error(`[CRITICAL] Failed to write receipt to MongoDB for key ${idempotencyKey}:`, err);
    });
};

module.exports = {
    getTransactionState,
    tryAcquireLock,
    forceAcquireLock,
    saveCompletedTransaction
};