const db = require('../config/db');

const authenticatePublic = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.key; // Header or Query

    if (!apiKey) {
        return res.status(401).json({ error: 'Missing API Key' });
    }

    try {
        const result = await db.query(
            'SELECT * FROM merchants WHERE api_key = $1',
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API Key' });
        }

        req.merchant = result.rows[0];
        next();
    } catch (err) {
        console.error('Public Auth Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = authenticatePublic;
