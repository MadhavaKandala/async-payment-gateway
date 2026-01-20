const db = require('../config/db');
const { webhookQueue } = require('../utils/queue');

module.exports = async (job) => {
    const { refundId } = job.data;
    const isTestMode = process.env.TEST_MODE === 'true';

    try {
        // 1. Fetch Refund
        const result = await db.query('SELECT * FROM refunds WHERE id = $1', [refundId]);
        if (result.rows.length === 0) return;
        const refund = result.rows[0];

        // 2. Delay
        const delay = isTestMode ? 1000 : (Math.floor(Math.random() * 2000) + 3000); // 3-5 sec
        await new Promise(resolve => setTimeout(resolve, delay));

        // 3. Update Status
        const now = new Date();
        await db.query(
            `UPDATE refunds SET status = 'processed', processed_at = $1 WHERE id = $2`,
            [now, refundId]
        );

        // 4. Create Webhook Log
        const eventType = 'refund.processed';
        const payload = {
            event: eventType,
            timestamp: Math.floor(now.getTime() / 1000),
            data: {
                refund: {
                    id: refund.id,
                    payment_id: refund.payment_id,
                    amount: refund.amount,
                    reason: refund.reason,
                    status: 'processed',
                    created_at: refund.created_at,
                    processed_at: now
                }
            }
        };

        const logResult = await db.query(
            `INSERT INTO webhook_logs (merchant_id, event, payload, status, created_at)
         VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
            [refund.merchant_id, eventType, payload, now]
        );
        const webhookLogId = logResult.rows[0].id;

        await webhookQueue.add('deliver-webhook', { webhookLogId });

    } catch (err) {
        console.error('Refund Worker Error:', err);
    }
};
