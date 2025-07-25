// bot.js
const { checkWin, checkDraw } = require('./utils');

function minimax(board, isBotTurn, bot, human) {
  if (checkWin(board, bot)) return { score: 1 };
  if (checkWin(board, human)) return { score: -1 };
  if (checkDraw(board)) return { score: 0 };

  const moves = [];

  for (let i = 0; i < board.length; i++) {
    if (board[i] === " ") {
      const newBoard = board.slice();
      newBoard[i] = isBotTurn ? bot : human;

      const result = minimax(newBoard, !isBotTurn, bot, human);
      moves.push({ index: i, score: result.score });
    }
  }

  // If no moves available (shouldn't happen with proper game logic)
  if (moves.length === 0) {
    return { score: 0 };
  }

  if (isBotTurn) {
    return moves.reduce((best, move) => move.score > best.score ? move : best);
  } else {
    return moves.reduce((best, move) => move.score < best.score ? move : best);
  }
}

function botMove(game) {
  // Safety check - make sure it's actually the bot's turn
  if (game.currentPlayer !== "O" || game.playerO !== "BOT") {
    console.error("Bot move called when it's not bot's turn");
    return;
  }

  // Safety check - make sure game isn't over
  if (game.winner || game.isDraw) {
    console.error("Bot move called when game is over");
    return;
  }

  const bot = "O";  // Bot is always O
  const human = "X"; // Human is always X

  const bestMove = minimax(game.board, true, bot, human);
  
  // Safety check - make sure we got a valid move
  if (!bestMove || bestMove.index === undefined) {
    console.error("No valid move found");
    return;
  }

  // Make sure the position is still available (double-check)
  if (game.board[bestMove.index] !== " ") {
    console.error("Bot tried to move to occupied position");
    return;
  }

  game.board[bestMove.index] = bot;

  if (checkWin(game.board, bot)) {
    game.winner = bot;
  } else if (checkDraw(game.board)) {
    game.isDraw = true;
  } else {
    game.currentPlayer = human;
  }
}

module.exports = { botMove };