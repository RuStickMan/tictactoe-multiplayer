// api.js
const { v4: uuidv4 } = require('uuid'); // Add this missing import
const { checkWin, checkDraw } = require('./utils');

function setupRoutes(app, games, queue, botMove) {
  // Serve static files
  app.use(require('express').static('.'));

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });

  app.get('/queue-status/:playerId', (req, res) => {
  const playerId = req.params.playerId;

  // Check if player is in the queue (waiting)
  const waiting = queue.find(p => p.playerId === playerId);
  if (waiting) {
    return res.json({ matched: false });
  }

  // Check if player is in any active game
  for (const [gameId, game] of games.entries()) {
    if (game.playerX === playerId || game.playerO === playerId) {
      return res.json({ matched: true, gameId });
    }
  }

  // If not in queue or game, probably invalid or timed out
  return res.status(404).json({ error: "Player not found in queue or game" });
});


  app.post('/join', (req, res) => {
    const playerId = uuidv4();

    const existing = queue.shift(); // get first player waiting
    if (existing) {
      queue.splice(queue.indexOf(existing), 1);

      const gameId = uuidv4();
      const game = {
        id: gameId,
        board: Array(9).fill(" "),
        currentPlayer: "X",
        playerX: existing.playerId,
        playerO: playerId,
        winner: null,
        isDraw: false,
        vsBot: false
      };

      games.set(gameId, game);
      return res.json({ 
        message: "Matched with another player", 
        gameId, 
        symbol: "O",
        playerId: playerId 
      });
    } else {
      // Add to queue and set timeout for bot fallback
      const queueEntry = { playerId, timestamp: Date.now() };
      queue.push(queueEntry);

      setTimeout(() => {
        const stillWaiting = queue.find(p => p.playerId === playerId);
        if (stillWaiting) {
          queue.splice(queue.indexOf(stillWaiting), 1);

          const gameId = uuidv4();
          const game = {
            id: gameId,
            board: Array(9).fill(" "),
            currentPlayer: "X",
            playerX: playerId,
            playerO: "BOT",
            winner: null,
            isDraw: false,
            vsBot: true
          };

          games.set(gameId, game);

          // Don't make bot move here - let the polling pick it up
        }
      }, 10000);

      return res.json({ 
        message: "Waiting for opponent...", 
        playerId,
        symbol: "X"
      });
    }
  });

  app.get('/state/:gameId', (req, res) => {
    const game = games.get(req.params.gameId);
    if (!game) return res.status(404).json({ error: "Game not found" });

    // If it's bot's turn and game is not over, make bot move
    if (game.vsBot && game.currentPlayer === "O" && !game.winner && !game.isDraw) {
      botMove(game);
    }

    res.json(game);
  });

  // Remove the problematic /newgame endpoint since we're using /join
  // app.post('/newgame', (req, res) => {
  //   // This endpoint was causing issues - removed
  // });

  app.post('/move', (req, res) => {
    const { gameId, playerId, position } = req.body;
    const game = games.get(gameId);

    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.winner || game.isDraw) return res.status(400).json({ error: "Game over" });

    const currentSymbol = game.playerX === playerId ? "X" : (game.playerO === playerId ? "O" : null);
    if (!currentSymbol) return res.status(403).json({ error: "You're not part of this game" });
    if (game.currentPlayer !== currentSymbol) return res.status(400).json({ error: "Not your turn" });
    if (game.board[position] !== " ") return res.status(400).json({ error: "Invalid move" });

    game.board[position] = currentSymbol;

    if (checkWin(game.board, currentSymbol)) {
      game.winner = currentSymbol;
    } else if (checkDraw(game.board)) {
      game.isDraw = true;
    } else {
      game.currentPlayer = currentSymbol === "X" ? "O" : "X";
    }

    // Let bot respond if needed (will be handled by next /state call)
    if (game.vsBot && game.currentPlayer === "O" && !game.winner && !game.isDraw) {
      botMove(game);
    }

    res.json(game);
  });
}

module.exports = { setupRoutes };