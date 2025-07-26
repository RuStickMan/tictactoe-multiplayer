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
    cellEl.className = `cell ${cell === "X" ? "x" : cell === "O" ? "o" : ""}`;
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

  // Animate status updates
  statusEl.classList.add("animate-pulse");
  setTimeout(() => statusEl.classList.remove("animate-pulse"), 500);

  if (gameState.winner) {
    statusEl.textContent = `Player ${gameState.winner} wins!`;
    statusEl.classList.add("text-green-600", "font-bold");
    stopPolling();
  } else if (gameState.isDraw) {
    statusEl.textContent = "It's a draw!";
    statusEl.classList.add("text-yellow-600", "font-bold");
    stopPolling();
  } else {
    if (gameState.currentPlayer === playerSymbol) {
      statusEl.textContent = `Your turn (${playerSymbol})`;
      statusEl.classList.add("text-blue-600");
    } else {
      if (gameState.vsBot) {
        statusEl.textContent = "Bot is thinking...";
        statusEl.classList.add("text-gray-600");
      } else {
        statusEl.textContent = `Opponent's turn (${gameState.currentPlayer})`;
        statusEl.classList.add("text-gray-600");
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
      statusEl.textContent = `Error: ${error.error}`;
      statusEl.classList.add("text-red-600");
    }
  } catch (error) {
    console.error('Error making move:', error);
    statusEl.textContent = "Error making move. Please try again.";
    statusEl.classList.add("text-red-600");
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
          statusEl.classList.add("text-green-600");
          await fetchState();
          startPolling();
          return;
        } else {
          statusEl.textContent = "Waiting for opponent...";
          statusEl.classList.add("text-gray-600");
        }
      }
    } catch (e) {
      console.error("Error checking queue status", e);
      statusEl.textContent = "Error checking queue. Please try again.";
      statusEl.classList.add("text-red-600");
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
  statusEl.classList.add("text-gray-600");
  boardEl.innerHTML = "";

  try {
    const res = await fetch('/join', { method: 'POST' });
    const data = await res.json();

    playerId = data.playerId;
    playerSymbol = data.symbol;

    if (data.gameId) {
      gameId = data.gameId;
      statusEl.textContent = "Game started!";
      statusEl.classList.add("text-green-600");
      await fetchState();
      startPolling();
    } else {
      statusEl.textContent = "Waiting for opponent...";
      statusEl.classList.add("text-gray-600");
      waitForQueueMatch();
    }
  } catch (error) {
    console.error('Error starting game:', error);
    statusEl.textContent = "Error starting game. Please try again.";
    statusEl.classList.add("text-red-600");
  }
}

window.onload = () => {
  newGame();
};