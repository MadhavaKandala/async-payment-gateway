const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/auth');
const authenticatePublic = require('../middleware/authPublic');
const { paymentQueue } = require('../utils/queue');
const { generateId } = require('../utils/helpers');

router.post('/payments', authenticate, async (req, res) => {
    const { amount, currency, method, vpa, order_id } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];
    const merchantId = req.merchant.id;

    // 1. Idempotency Check
    if (idempotencyKey) {
        try {
            const existingKey = await db.query(
                'SELECT * FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
                [idempotencyKey, merchantId]
            );

            if (existingKey.rows.length > 0) {
                const record = existingKey.rows[0];
                const now = new Date();
                if (new Date(record.expires_at) > now) {
                    return res.status(201).json(record.response);
                } else {
                    // Expired, delete and continue
                    await db.query(
                        'DELETE FROM idempotency_keys WHERE key = $1 AND merchant_id = $2',
                        [idempotencyKey, merchantId]
                    );
                }
            }
        } catch (err) {
            console.error('Idempotency Check Error:', err);
            // Continue processing if check fails? Or error? Let's log and continue for now or error.
            // Ideally safer to error if idempotency fails.
        }
    }

    // 2. Validation
    if (!amount || !currency || !method || !order_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (method === 'upi' && !vpa) {
        return res.status(400).json({ error: 'VPA required for UPI' });
    }

    const paymentId = generateId('pay_');
    const now = new Date();

    // 3. Create Payment Record
    try {
        const payment = {
            id: paymentId,
            merchant_id: merchantId,
            order_id,
            amount,
            currency,
            method,
            vpa: vpa || null,
            status: 'pending',
            created_at: now
        };

        await db.query(
            `INSERT INTO payments (id, merchant_id, order_id, amount, currency, method, vpa, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
            [payment.id, payment.merchant_id, payment.order_id, payment.amount, payment.currency, payment.method, payment.vpa, payment.status, payment.created_at]
        );

        // 4. Enqueue Job
        await paymentQueue.add('process-payment', { paymentId });

        // 5. Response
        const response = {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            vpa: payment.vpa,
            status: payment.status,
            created_at: payment.created_at
        };

        // 6. Save Idempotency
        if (idempotencyKey) {
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            await db.query(
                `INSERT INTO idempotency_keys (key, merchant_id, response, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
                [idempotencyKey, merchantId, response, now, expiresAt]
            );
        }

        res.status(201).json(response);

    } catch (err) {
        console.error('Create Payment Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/payments/:id/capture', authenticate, async (req, res) => {
    const paymentId = req.params.id;
    const merchantId = req.merchant.id;
    const { amount } = req.body;

    try {
        const result = await db.query(
            'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
            [paymentId, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const payment = result.rows[0];

        if (payment.status !== 'success') {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST_ERROR',
                    description: 'Payment not in capturable state'
                }
            });
        }

        if (payment.captured) {
            return res.status(400).json({ error: 'Payment already captured' });
        }

        // In a real system, you might verify amount matches or allows partial capture.

        const now = new Date();
        await db.query(
            'UPDATE payments SET captured = TRUE, updated_at = $1 WHERE id = $2',
            [now, paymentId]
        );

        const updatedPayment = {
            ...payment,
            captured: true,
            updated_at: now
        };

        // Sanitize response to match requirements ?
        // "id": "pay_...", "order_id": ..., "amount"..., "captured": true

        res.json({
            id: updatedPayment.id,
            order_id: updatedPayment.order_id,
            amount: updatedPayment.amount,
            currency: updatedPayment.currency,
            method: updatedPayment.method,
            status: updatedPayment.status,
            captured: true,
            created_at: updatedPayment.created_at,
            updated_at: updatedPayment.updated_at
        });

    } catch (err) {
        console.error('Capture Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Public Checkout Routes
router.post('/checkout/process', authenticatePublic, async (req, res) => {
    const { amount, currency, method, vpa, order_id } = req.body;
    const merchantId = req.merchant.id;

    if (!amount || !currency || !method || !order_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentId = generateId('pay_');
    const now = new Date();

    try {
        await db.query(
            `INSERT INTO payments (id, merchant_id, order_id, amount, currency, method, vpa, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)`,
            [paymentId, merchantId, order_id, amount, currency, method, vpa || null, now]
        );

        await paymentQueue.add('process-payment', { paymentId });

        res.status(201).json({
            id: paymentId,
            status: 'pending'
        });

    } catch (err) {
        console.error('Checkout Process Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/checkout/status/:id', authenticatePublic, async (req, res) => {
    const paymentId = req.params.id;
    const merchantId = req.merchant.id;

    try {
        const result = await db.query(
            'SELECT status, error_code, error_description FROM payments WHERE id = $1 AND merchant_id = $2',
            [paymentId, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

module.exports = router;
