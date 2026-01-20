const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/auth');
const { webhookQueue } = require('../utils/queue');

router.get('/webhooks', authenticate, async (req, res) => {
    const merchantId = req.merchant.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const countResult = await db.query(
            'SELECT COUNT(*) FROM webhook_logs WHERE merchant_id = $1',
            [merchantId]
        );
        const total = parseInt(countResult.rows[0].count);

        const logsResult = await db.query(
            'SELECT * FROM webhook_logs WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [merchantId, limit, offset]
        );

        res.json({
            data: logsResult.rows,
            total,
            limit,
            offset
        });
    } catch (err) {
        console.error('List Webhooks Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/webhooks/:webhook_id/retry', authenticate, async (req, res) => {
    const webhookId = req.params.webhook_id;
    const merchantId = req.merchant.id;

    try {
        const result = await db.query(
            'SELECT * FROM webhook_logs WHERE id = $1 AND merchant_id = $2',
            [webhookId, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Webhook log not found' });
        }

        // Update log
        await db.query(
            `UPDATE webhook_logs 
         SET status = 'pending', attempts = 0, next_retry_at = NULL 
         WHERE id = $1`,
            [webhookId]
        );

        // Enqueue job
        // We need to pass the log ID so the worker can fetch it and deliver it.
        // Spec says: "Enqueue DeliverWebhookJob".
        // My Worker will need { webhookLogId }
        await webhookQueue.add('deliver-webhook', { webhookLogId: webhookId });

        res.json({
            id: webhookId,
            status: 'pending',
            message: 'Webhook retry scheduled'
        });

    } catch (err) {
        console.error('Retry Webhook Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/webhooks/config', authenticate, async (req, res) => {
    const merchantId = req.merchant.id;
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        await db.query(
            'UPDATE merchants SET webhook_url = $1, updated_at = NOW() WHERE id = $2',
            [url, merchantId]
        );
        res.json({ message: 'Configuration saved' });
    } catch (err) {
        console.error('Config Webhook Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
