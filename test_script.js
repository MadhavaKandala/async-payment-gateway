const crypto = require('crypto');

const API_URL = 'http://localhost:8000/api/v1';
const API_KEY = 'key_test_abc123';
const API_SECRET = 'secret_test_xyz789';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
    console.log('🚀 Starting Automated Tests...');

    // 1. Health Check (Test Endpoints)
    try {
        const res = await fetch(`${API_URL}/test/jobs/status`);
        if (!res.ok) throw new Error('Health check failed');
        console.log('✅ API is reachable');
    } catch (e) {
        console.error('❌ API Unreachable:', e.message);
        process.exit(1);
    }

    // 2. Create Payment
    let paymentId, orderId;
    try {
        orderId = `ord_${Date.now()}`;
        const res = await fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': API_KEY,
                'X-Api-Secret': API_SECRET
            },
            body: JSON.stringify({
                amount: 1000,
                currency: 'INR',
                method: 'card',
                order_id: orderId
            })
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        paymentId = data.id;
        console.log(`✅ Payment Created: ${paymentId} (Status: ${data.status})`);
    } catch (e) {
        console.error('❌ Create Payment Failed:', e.message);
        process.exit(1);
    }

    // 3. Poll for Completion (Async Worker)
    console.log('⏳ Waiting for Payment Processing (Async Worker)...');
    let paymentStatus = 'pending';
    for (let i = 0; i < 15; i++) {
        await sleep(2000); // Wait 2s

        // Simulate getting status (using Capture endpoint as a proxy to check status? No, capture requires success)
        // Or just create a simple GET /payments/:id ? I didn't verify I created one.
        // The instructions didn't explicitly ask for GET /payments/:id in "Updated API Endpoints", only Create, Capture, Refund.
        // BUT usually you need it.
        // Wait, the "Capture Payment Endpoint" returns the payment object.
        // But it requires status 'success' to capture.
        // I can use `GET /checkout/status/:id` which I created!

        const res = await fetch(`${API_URL}/checkout/status/${paymentId}?key=${API_KEY}`);
        const data = await res.json();
        paymentStatus = data.status;

        if (paymentStatus === 'success' || paymentStatus === 'failed') {
            console.log(`✅ Payment Processed: ${paymentStatus}`);
            break;
        }
    }

    if (paymentStatus === 'pending') {
        console.warn('⚠️ Payment still pending after 30s (Worker might be slow/down)');
    }

    // 4. Idempotency Test
    try {
        const idemKey = `idem_${Date.now()}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY,
            'X-Api-Secret': API_SECRET,
            'Idempotency-Key': idemKey
        };

        const body = JSON.stringify({
            amount: 2000,
            currency: 'INR',
            method: 'card',
            order_id: `ord_${Date.now()}`
        });

        console.log('🔄 Testing Idempotency...');
        const req1 = await fetch(`${API_URL}/payments`, { method: 'POST', headers, body });
        const data1 = await req1.json();

        const req2 = await fetch(`${API_URL}/payments`, { method: 'POST', headers, body });
        const data2 = await req2.json();

        if (data1.id === data2.id && data1.created_at === data2.created_at) {
            console.log('✅ Idempotency Verified (Ids match)');
        } else {
            console.error('❌ Idempotency Failed (Ids differ)');
        }
    } catch (e) {
        console.error('❌ Idempotency Test Error:', e.message);
    }

    // 5. Refund Test
    if (paymentStatus === 'success') {
        try {
            const res = await fetch(`${API_URL}/payments/${paymentId}/refunds`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': API_KEY,
                    'X-Api-Secret': API_SECRET
                },
                body: JSON.stringify({
                    amount: 500
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`✅ Refund Initiated: ${data.id}`);
            } else {
                console.error(`❌ Refund Failed: ${await res.text()}`);
            }
        } catch (e) {
            console.error('❌ Refund Error:', e.message);
        }
    }

    // 6. Webhook Logs
    try {
        const res = await fetch(`${API_URL}/webhooks`, {
            headers: {
                'X-Api-Key': API_KEY,
                'X-Api-Secret': API_SECRET
            }
        });
        const data = await res.json();
        console.log(`✅ Webhook Logs Fetched: ${data.total} logs found.`);
        if (data.data.length > 0) {
            console.log(`   Last Log Event: ${data.data[0].event} (${data.data[0].status})`);
        }
    } catch (e) {
        console.error('❌ Webhook Logs Error:', e.message);
    }

    // 7. SDK File
    try {
        const res = await fetch('http://localhost:3001/checkout.js');
        if (res.ok) {
            console.log('✅ SDK Bundle is accessible');
        } else {
            console.error('❌ SDK Bundle not found');
        }
    } catch (e) {
        console.error('❌ SDK Error:', e.message);
    }
}

runTests();
