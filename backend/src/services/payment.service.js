/**
 * Simulates a time-consuming payment processing task.
 */
const executeCharge = async (amount, currency, source) => {
    return new Promise((resolve) => {
        // Simulate a 2.5 second network delay to the bank
        setTimeout(() => {
            resolve({
                transactionId: `txn_${Date.now()}`,
                status: 'success',
                amount: amount,
                currency: currency,
                message: 'Payment processed successfully'
            });
        }, 2500);
    });
};

module.exports = {
    executeCharge
};