// index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config.json');

// ✅ Create the app first before using it
const app = express();
const port = config.port || 3000;

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Game logic dependencies
const { setupRoutes } = require('./api');
const { botMove } = require('./bot');
const { checkWin, checkDraw } = require('./utils');

const games = new Map();
const queue = [];

// ✅ Setup API routes after app is created
setupRoutes(app, games, queue, botMove);

// ✅ Start server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
