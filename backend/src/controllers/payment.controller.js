const idempotencyService = require('../services/idempotency.service');
const paymentService = require('../services/payment.service');

const processPayment = async (req, res) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey) {
            return res.status(400).json({ error: 'Idempotency-Key header is required' });
        }

        const { amount, currency, source } = req.body;
        let gotLock = await idempotencyService.tryAcquireLock(idempotencyKey);

        if (!gotLock) {
            const cachedState = await idempotencyService.getTransactionState(idempotencyKey);
            
            // THE ZOMBIE TRAP
            if (cachedState.status === 'PROCESSING') {
                const lockAgeMs = Date.now() - Number(cachedState.startedAt);
                const ZOMBIE_THRESHOLD_MS = 45000; // 45 seconds

                if (lockAgeMs > ZOMBIE_THRESHOLD_MS) {
                    console.warn(`[WARNING] Zombie lock detected for ${idempotencyKey}. Forcing recovery...`);
                    await idempotencyService.forceAcquireLock(idempotencyKey);
                    gotLock = true; 
                } else {
                    return res.status(409).json({ 
                        error: 'Conflict: A payment with this key is currently being processed. Please wait.' 
                    });
                }
            }

            // STATE C: The Network Drop / Retry
            if (cachedState.status === 'COMPLETED') {
                const cachedReceipt = JSON.parse(cachedState.responseBody);
                return res.status(Number(cachedState.httpCode)).json(cachedReceipt);
            }
        }

        // --- THE EVENT-DRIVEN UPGRADE ---
        if (gotLock) {
            // 1. INSTANT RESPONSE: Close the HTTP connection immediately
            res.status(202).json({
                status: 'processing',
                message: 'Transaction accepted. Awaiting bank confirmation...'
            });

            // 2. BACKGROUND TASK: Notice we do NOT use 'await' here!
            paymentService.executeCharge(amount, currency, source)
                .then(async (paymentReceipt) => {
                    // Save to Redis and Mongo (Permanent Ledger)
                    await idempotencyService.saveCompletedTransaction(idempotencyKey, 200, paymentReceipt);
                    
                    // 3. THE WEBSOCKET EMIT: Tell the React frontend the money cleared!
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('payment_cleared', {
                            idempotencyKey: idempotencyKey,
                            receipt: paymentReceipt
                        });
                    }
                })
                .catch(err => console.error('Background processing failed:', err));
            
            return; // Exit the function immediately while the background task runs
        }

    } catch (error) {
        console.error('Payment Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { processPayment };