const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve SDK bundle
app.use(express.static(path.join(__dirname, 'dist')));

// Serve Checkout Page logic
app.get('/checkout', (req, res) => {
    // Return the Checkout Application (iframe content)
    // For simplicity, just sending a static HTML with embedded script
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Checkout service running on port ${PORT}`);
});
