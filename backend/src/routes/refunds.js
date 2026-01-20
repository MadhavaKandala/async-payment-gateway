const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/auth');
const { refundQueue } = require('../utils/queue');
const { generateId } = require('../utils/helpers');

router.post('/payments/:payment_id/refunds', authenticate, async (req, res) => {
    const paymentId = req.params.payment_id;
    const merchantId = req.merchant.id;
    const { amount, reason } = req.body;

    if (!amount) {
        return res.status(400).json({ error: 'Amount is required' });
    }

    try {
        // 1. Fetch Payment
        const paymentResult = await db.query(
            'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
            [paymentId, merchantId]
        );

        if (paymentResult.rows.length === 0) {
            // 404 or 400 as per spec? Spec says "Return 404 or 400".
            return res.status(404).json({ error: 'Payment not found' });
        }

        const payment = paymentResult.rows[0];

        // 2. Verify Payment State
        if (payment.status !== 'success') {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST_ERROR',
                    description: 'Payment not in capturable state' // Reusing the error code format, message customized?
                    // Spec says: Return 400 with error code "BAD_REQUEST_ERROR" description "Refund amount..." or "Payment status..."
                }
            });
        }

        // Correction: "Payment status must be 'success'"
        // The spec error for status check is not explicitly detailed with a separate message but "BAD_REQUEST_ERROR" is good.

        // 3. Calculate Total Refunded
        const refundsResult = await db.query(
            `SELECT SUM(amount) as total FROM refunds 
       WHERE payment_id = $1 AND status IN ('processed', 'pending')`,
            [paymentId]
        );
        const totalRefunded = parseInt(refundsResult.rows[0].total || '0');

        // 4. Validate Amount
        if (amount > (payment.amount - totalRefunded)) {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST_ERROR',
                    description: 'Refund amount exceeds available amount'
                }
            });
        }

        // 5. Create Refund
        const refundId = generateId('rfnd_');
        const now = new Date(); // created_at

        await db.query(
            `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [refundId, paymentId, merchantId, amount, reason, 'pending', now]
        );

        // 6. Enqueue Job
        await refundQueue.add('process-refund', { refundId });

        // 7. Response
        res.status(201).json({
            id: refundId,
            payment_id: paymentId,
            amount,
            reason,
            status: 'pending',
            created_at: now
        });

    } catch (err) {
        console.error('Create Refund Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/refunds/:id', authenticate, async (req, res) => {
    const refundId = req.params.id;
    const merchantId = req.merchant.id;

    try {
        const result = await db.query(
            'SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2',
            [refundId, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Refund not found' });
        }

        const refund = result.rows[0];

        // Format response
        const response = {
            id: refund.id,
            payment_id: refund.payment_id,
            amount: refund.amount,
            reason: refund.reason,
            status: refund.status,
            created_at: refund.created_at,
            processed_at: refund.processed_at
        };

        res.json(response);

    } catch (err) {
        console.error('Get Refund Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
