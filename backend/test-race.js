// test-race.js
const runTest = async () => {
    // We generate a dynamic key so we don't have to keep changing it manually
    const idempotencyKey = `order_race_${Date.now()}`;
    const url = 'http://localhost:3000/api/v1/payments';
    
    const requestConfig = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'idempotency-key': idempotencyKey
        },
        body: JSON.stringify({ amount: 500, currency: "USD" })
    };

    console.log(`🚀 Firing 2 simultaneous requests for key: ${idempotencyKey}...`);

    // Fire both requests at the EXACT same millisecond without waiting
    const request1 = fetch(url, requestConfig);
    const request2 = fetch(url, requestConfig);

    // Wait for both to resolve
    const [response1, response2] = await Promise.all([request1, request2]);

    const data1 = await response1.json();
    const data2 = await response2.json();

    console.log("\n--- TEST RESULTS ---");
    console.log(`[Request 1] Status: ${response1.status}`, data1);
    console.log(`[Request 2] Status: ${response2.status}`, data2);
};

runTest();