const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");

let gameState = null;
let gameId = null;
let playerId = null;
let playerSymbol = null;
let pollInterval = null;

function renderBoard() {
  if (!gameState) return;

  boardEl.innerHTML = "";
  gameState.board.forEach((cell, index) => {
    const cellEl = document.createElement("div");
    cellEl.className = "cell";
    cellEl.textContent = cell === " " ? "" : cell;

    // Enable click only if player's turn and cell empty and game ongoing
    if (!gameState.winner && !gameState.isDraw &&
        gameState.currentPlayer === playerSymbol &&
        cell === " ") {
      cellEl.onclick = () => makeMove(index);
      cellEl.style.cursor = "pointer";
    } else {
      cellEl.style.cursor = "default";
    }

    boardEl.appendChild(cellEl);
  });

  if (gameState.winner) {
    statusEl.textContent = `Player ${gameState.winner} wins!`;
    stopPolling();
  } else if (gameState.isDraw) {
    statusEl.textContent = "It's a draw!";
    stopPolling();
  } else {
    if (gameState.currentPlayer === playerSymbol) {
      statusEl.textContent = `Your turn (${playerSymbol})`;
    } else {
      if (gameState.vsBot) {
        statusEl.textContent = "Bot is thinking...";
      } else {
        statusEl.textContent = `Opponent's turn (${gameState.currentPlayer})`;
      }
    }
  }
}

async function fetchState() {
  if (!gameId) return;

  try {
    const res = await fetch(`/state/${gameId}`);
    if (res.ok) {
      gameState = await res.json();
      renderBoard();
    }
  } catch (error) {
    console.error('Error fetching game state:', error);
  }
}

async function makeMove(position) {
  if (!gameId || !playerId) return;

  try {
    const res = await fetch('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        playerId,
        position
      })
    });

    if (res.ok) {
      gameState = await res.json();
      renderBoard();
    } else {
      const error = await res.json();
      console.error('Move error:', error.error);
    }
  } catch (error) {
    console.error('Error making move:', error);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(() => {
    fetchState();
  }, 1000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function waitForQueueMatch() {
  const checkMatch = async () => {
    try {
      const res = await fetch(`/queue-status/${playerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.matched) {
          gameId = data.gameId;
          statusEl.textContent = "Game started!";
          await fetchState();
          startPolling();
          return;
        } else {
          statusEl.textContent = "Waiting for opponent...";
        }
      }
    } catch (e) {
      console.error("Error checking queue status", e);
    }
    setTimeout(checkMatch, 2000);
  };
  checkMatch();
}

async function newGame() {
  stopPolling();

  gameState = null;
  gameId = null;
  playerId = null;
  playerSymbol = null;

  statusEl.textContent = "Starting new game...";
  boardEl.innerHTML = "";

  try {
    const res = await fetch('/join', { method: 'POST' });
    const data = await res.json();

    playerId = data.playerId;
    playerSymbol = data.symbol;

    if (data.gameId) {
      gameId = data.gameId;
      statusEl.textContent = "Game started!";
      await fetchState();
      startPolling();
    } else {
      statusEl.textContent = "Waiting for opponent...";
      waitForQueueMatch();
    }
  } catch (error) {
    console.error('Error starting game:', error);
    statusEl.textContent = "Error starting game. Please try again.";
  }
}

window.onload = () => {
  newGame();
};
