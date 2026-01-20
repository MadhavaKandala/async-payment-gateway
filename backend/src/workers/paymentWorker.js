const db = require('../config/db');
const { webhookQueue } = require('../utils/queue');

module.exports = async (job) => {
    const { paymentId } = job.data;
    const isTestMode = process.env.TEST_MODE === 'true';

    try {
        // 1. Fetch Payment
        const result = await db.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
        if (result.rows.length === 0) return;
        const payment = result.rows[0];

        // 2. Simulate Delay
        const delay = isTestMode ? 1000 : (Math.floor(Math.random() * 5000) + 5000); // 5-10 sec
        await new Promise(resolve => setTimeout(resolve, delay));

        // 3. Determine Outcome
        let success = false;
        if (isTestMode) {
            success = process.env.TEST_PAYMENT_SUCCESS !== 'false'; // Default to true
        } else {
            if (payment.method === 'upi') {
                success = Math.random() < 0.90;
            } else {
                success = Math.random() < 0.95;
            }
        }

        // 4. Update Status
        const status = success ? 'success' : 'failed';
        const now = new Date();

        await db.query(
            'UPDATE payments SET status = $1, updated_at = $2 WHERE id = $3',
            [status, now, paymentId]
        );

        // Refresh payment data for webhook payload
        const updatedPayment = { ...payment, status, updated_at: now };

        // 5. Enqueue Webhook
        // Need to insert into webhook_logs first to get an ID?
        // The instructions say: "Enqueue a webhook delivery job... Include payment data in webhook payload".
        // And "Deliver Webhook Job receives merchant ID, event type, and payload data"
        // AND "Log webhook attempt in webhook_logs table" happens INSIDE the Deliver Job?
        // Wait, requirement says: "Log webhook attempt... Record attempt number" inside the job.
        // BUT "Deliver Webhook Job... Fetch merchant details... Log webhook attempt".
        // It seems the LOG entry creation should technically happen before or during the first attempt.
        // Actually, usually you create the log entry when the event happens, then the job retries it.
        // BUT the requirement Says: "Job receives merchant ID, event type, and payload data".
        // AND then "Log webhook attempt in webhook_logs table".
        // This implies the log might be created EACH attempt or the job manages one log entry.
        // Re-reading: "Log webhook attempt... Record attempt number (increment)..."
        // This implies updating an existing log or creating a new attempt line designated to a parent log.
        // BUT Schema has `attempts` count in `webhook_logs`. So `webhook_logs` matches one EVENT.

        // Strategy: Create `webhook_logs` entry HERE (in PaymentWorker), then pass its ID to WebhookWorker.
        // OR Pass data to WebhookWorker, and let it create the log if it implies a fresh event?
        // Requirement 2: "Job receives merchant ID, event type, and payload data" -> This implies it DOES NOT receive a Log ID initially.
        // BUT Retry Endpoint says: "Reset attempts to 0... Enqueue DeliverWebhookJob". This implies reusing the Log ID.
        // So WebhookWorker must support both: Creating a new Log (if first time) OR Using existing Log (if retry).
        // Let's CREATE the log entry here to ensure we have a record of the event even if the job fails to start.

        const eventType = success ? 'payment.success' : 'payment.failed';
        const payload = {
            event: eventType,
            timestamp: Math.floor(now.getTime() / 1000),
            data: {
                payment: {
                    id: updatedPayment.id,
                    order_id: updatedPayment.order_id,
                    amount: updatedPayment.amount,
                    currency: updatedPayment.currency,
                    method: updatedPayment.method,
                    vpa: updatedPayment.vpa,
                    status: updatedPayment.status,
                    created_at: updatedPayment.created_at
                }
            }
        };

        const logResult = await db.query(
            `INSERT INTO webhook_logs (merchant_id, event, payload, status, created_at)
         VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
            [payment.merchant_id, eventType, payload, now]
        );
        const webhookLogId = logResult.rows[0].id;

        await webhookQueue.add('deliver-webhook', { webhookLogId });

    } catch (err) {
        console.error('Payment Worker Error:', err);
    }
};
