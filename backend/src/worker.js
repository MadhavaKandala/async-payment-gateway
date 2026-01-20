require('dotenv').config();
const { Worker } = require('bullmq');
const connection = require('./config/redis');

// Import Workers
const paymentWorker = require('./workers/paymentWorker');
const refundWorker = require('./workers/refundWorker');
const webhookWorker = require('./workers/webhookWorker');

console.log('Starting workers...');

// Initialize Workers
new Worker('payment-queue', paymentWorker, { connection });
new Worker('refund-queue', refundWorker, { connection });
new Worker('webhook-queue', webhookWorker, { connection });

console.log('Workers started successfully.');
