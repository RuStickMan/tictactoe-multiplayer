// utils.js

function checkWin(board, player) {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  return wins.some(([a,b,c]) =>
    board[a] === player && board[b] === player && board[c] === player
  );
}

function checkDraw(board) {
  return board.every(cell => cell !== " ");
}

module.exports = { checkWin, checkDraw };
