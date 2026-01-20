const { Queue } = require('bullmq');
const connection = require('../config/redis');

const paymentQueue = new Queue('payment-queue', { connection });
const refundQueue = new Queue('refund-queue', { connection });
const webhookQueue = new Queue('webhook-queue', { connection });

module.exports = {
    paymentQueue,
    refundQueue,
    webhookQueue,
};
