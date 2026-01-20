const db = require('../config/db');
const { webhookQueue } = require('../utils/queue');
const crypto = require('crypto');

module.exports = async (job) => {
    const { webhookLogId } = job.data;
    const isTestMode = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';

    try {
        // 1. Fetch Log
        const logResult = await db.query('SELECT * FROM webhook_logs WHERE id = $1', [webhookLogId]);
        if (logResult.rows.length === 0) return;
        const log = logResult.rows[0];

        // 2. Fetch Merchant
        const merchantResult = await db.query('SELECT * FROM merchants WHERE id = $1', [log.merchant_id]);
        const merchant = merchantResult.rows[0];

        if (!merchant.webhook_url) {
            await db.query(`UPDATE webhook_logs SET status = 'failed', response_body = 'No Webhook URL configured' WHERE id = $1`, [webhookLogId]);
            return;
        }

        // 3. Prepare Request
        const payloadString = JSON.stringify(log.payload);
        const signature = crypto
            .createHmac('sha256', merchant.webhook_secret)
            .update(payloadString)
            .digest('hex');

        const currentAttempt = log.attempts + 1;
        let responseCode = null;
        let responseBody = null;
        let success = false;

        // 4. Send Request
        try {
            const response = await fetch(merchant.webhook_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature
                },
                body: payloadString,
                signal: AbortSignal.timeout(5000) // 5s timeout
            });

            responseCode = response.status;
            const text = await response.text();
            responseBody = text.substring(0, 1000); // Truncate
            success = response.ok;

        } catch (err) {
            responseCode = 0; // Network error
            responseBody = err.message;
            success = false;
        }

        // 5. Update Log
        const now = new Date();
        await db.query(
            `UPDATE webhook_logs 
         SET attempts = $1, last_attempt_at = $2, response_code = $3, response_body = $4, status = $5
         WHERE id = $6`,
            [currentAttempt, now, responseCode, responseBody, success ? 'success' : 'pending', webhookLogId]
        );

        // 6. Handle Retry
        if (!success) {
            if (currentAttempt >= 5) {
                // Give up
                await db.query(`UPDATE webhook_logs SET status = 'failed' WHERE id = $1`, [webhookLogId]);
            } else {
                // Schedule Retry
                let delaySeconds = 0;
                if (isTestMode) {
                    // Test Intervals: 0, 5, 10, 15, 20
                    // Attempt 1 (just happened) -> Next is Attempt 2 -> 5s
                    // Attempt 2 -> Next 3 -> 10s
                    const delays = [0, 5, 10, 15, 20];
                    delaySeconds = delays[currentAttempt] || 20;
                } else {
                    // Prod: 1m, 5m, 30m, 2h
                    const delays = [0, 60, 300, 1800, 7200];
                    delaySeconds = delays[currentAttempt] || 7200;
                }

                const nextRetryAt = new Date(now.getTime() + delaySeconds * 1000);

                await db.query(
                    `UPDATE webhook_logs SET next_retry_at = $1 WHERE id = $2`,
                    [nextRetryAt, webhookLogId]
                );

                // Re-enqueue with delay
                await webhookQueue.add('deliver-webhook', { webhookLogId }, { delay: delaySeconds * 1000 });
            }
        }

    } catch (err) {
        console.error('Webhook Worker Error:', err);
    }
};
