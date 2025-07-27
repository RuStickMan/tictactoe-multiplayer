const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { checkWin, checkDraw } = require('./utils');
const { botMove } = require('./bot');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const games = new Map();
const queue = [];

async function loadLeaderboard() {
  try {
    const data = await fs.readFile('leaderboard.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { players: {} };
  }
}

async function saveLeaderboard(leaderboard) {
  await fs.writeFile('leaderboard.json', JSON.stringify(leaderboard, null, 2));
}

app.post('/join', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const playerId = uuidv4();
  const symbol = queue.length === 0 ? 'X' : 'O';

  const leaderboard = await loadLeaderboard();
  if (!leaderboard.players[playerId]) {
    leaderboard.players[playerId] = { name, wins: 0, losses: 0, draws: 0 };
    await saveLeaderboard(leaderboard);
  }

  if (queue.length > 0) {
    const opponent = queue.shift();
    const gameId = uuidv4();
    const game = {
      id: gameId,
      board: Array(9).fill(' '),
      currentPlayer: 'X',
      playerX: opponent.playerId,
      playerO: playerId,
      winner: null,
      isDraw: false,
      vsBot: false,
      playerXName: opponent.name,
      playerOName: name
    };
    games.set(gameId, game);
    return res.json({ gameId, playerId, symbol });
  } else {
    queue.push({ playerId, name });
    setTimeout(async () => {
      const stillWaiting = queue.find(p => p.playerId === playerId);
      if (stillWaiting) {
        queue.splice(queue.indexOf(stillWaiting), 1);
        const gameId = uuidv4();
        const game = {
          id: gameId,
          board: Array(9).fill(' '),
          currentPlayer: 'X',
          playerX: playerId,
          playerO: 'BOT',
          winner: null,
          isDraw: false,
          vsBot: true,
          playerXName: name,
          playerOName: 'Bot'
        };
        games.set(gameId, game);
      }
    }, 10000);
    return res.json({ playerId, symbol, name });
  }
});

app.get('/queue-status/:playerId', (req, res) => {
  const { playerId } = req.params;
  const game = Array.from(games.values()).find(
    g => g.playerX === playerId || g.playerO === playerId
  );
  if (game) {
    return res.json({ matched: true, gameId: game.id });
  }
  res.json({ matched: false });
});

app.post('/move', async (req, res) => {
  const { gameId, playerId, position } = req.body;

  const game = games.get(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if ((game.playerX !== playerId && game.playerO !== playerId) || game.winner || game.isDraw) {
    return res.status(400).json({ error: 'Invalid move' });
  }
  if (game.currentPlayer !== (game.playerX === playerId ? 'X' : 'O')) {
    return res.status(400).json({ error: 'Not your turn' });
  }
  if (game.board[position] !== ' ') {
    return res.status(400).json({ error: 'Cell already taken' });
  }

  game.board[position] = game.currentPlayer;
  game.winner = checkWin(game.board);
  game.isDraw = !game.winner && checkDraw(game.board);

  if (game.winner || game.isDraw) {
    const leaderboard = await loadLeaderboard();
    if (game.winner) {
      const winnerId = game.winner === 'X' ? game.playerX : game.playerO;
      const loserId = game.winner === 'X' ? game.playerO : game.playerX;
      if (winnerId !== 'BOT') leaderboard.players[winnerId].wins += 1;
      if (loserId !== 'BOT') leaderboard.players[loserId].losses += 1;
    } else if (game.isDraw) {
      if (game.playerX !== 'BOT') leaderboard.players[game.playerX].draws += 1;
      if (game.playerO !== 'BOT') leaderboard.players[game.playerO].draws += 1;
    }
    await saveLeaderboard(leaderboard);
  }

  game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';

  if (game.vsBot && game.currentPlayer === 'O' && !game.winner && !game.isDraw) {
    botMove(game);
    game.winner = checkWin(game.board);
    game.isDraw = !game.winner && checkDraw(game.board);
    if (game.winner || game.isDraw) {
      const leaderboard = await loadLeaderboard();
      if (game.winner) {
        const winnerId = game.winner === 'X' ? game.playerX : game.playerO;
        const loserId = game.winner === 'X' ? game.playerO : game.playerX;
        if (winnerId !== 'BOT') leaderboard.players[winnerId].wins += 1;
        if (loserId !== 'BOT') leaderboard.players[loserId].losses += 1;
      } else if (game.isDraw) {
        if (game.playerX !== 'BOT') leaderboard.players[game.playerX].draws += 1;
      }
      await saveLeaderboard(leaderboard);
    }
    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
  }

  res.json(game);
});

app.get('/state/:gameId', (req, res) => {
  const { gameId } = req.params;
  const game = games.get(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  if (game.vsBot && game.currentPlayer === 'O' && !game.winner && !game.isDraw) {
    botMove(game);
    game.winner = checkWin(game.board);
    game.isDraw = !game.winner && checkDraw(game.board);
    if (game.winner || game.isDraw) {
      const leaderboard = loadLeaderboard();
      if (game.winner) {
        const winnerId = game.winner === 'X' ? game.playerX : game.playerO;
        const loserId = game.winner === 'X' ? game.playerO : game.playerX;
        if (winnerId !== 'BOT') leaderboard.players[winnerId].wins += 1;
        if (loserId !== 'BOT') leaderboard.players[loserId].losses += 1;
      } else if (game.isDraw) {
        if (game.playerX !== 'BOT') leaderboard.players[game.playerX].draws += 1;
      }
      saveLeaderboard(leaderboard);
    }
    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
  }
  res.json(game);
});

app.get('/leaderboard', async (req, res) => {
  const leaderboard = await loadLeaderboard();
  res.json(leaderboard);
});

module.exports = app;