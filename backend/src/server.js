const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Placeholder for routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Import Routes
const paymentRoutes = require('./routes/payments');
const refundRoutes = require('./routes/refunds');
const webhookRoutes = require('./routes/webhooks');
const testRoutes = require('./routes/test');

app.use('/api/v1', paymentRoutes);
app.use('/api/v1', refundRoutes);
app.use('/api/v1', webhookRoutes);
app.use('/api/v1', testRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
