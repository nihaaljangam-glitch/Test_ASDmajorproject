// server.js – Entry point for the Traffic Management Backend API
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const trafficRoutes = require('./routes/trafficRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON request parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Smart Traffic Management backend is running');
});

// Traffic API Routes
app.use('/api/traffic', trafficRoutes);

// Start the Express server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
