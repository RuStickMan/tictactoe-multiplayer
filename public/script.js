const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const moveSound = document.getElementById("move-sound");
const winSound = document.getElementById("win-sound");
const drawSound = document.getElementById("draw-sound");
const nameEntryEl = document.getElementById("name-entry");
const gameContainerEl = document.getElementById("game-container");
const playerNameInput = document.getElementById("player-name");
const joinGameBtn = document.getElementById("join-game");
const leaderboardListEl = document.getElementById("leaderboard-list");

let gameState = null;
let gameId = null;
let playerId = null;
let playerSymbol = null;
let playerName = null;
let pollInterval = null;

async function fetchLeaderboard() {
  try {
    const res = await fetch('/leaderboard');
    if (res.ok) {
      const data = await res.json();
      leaderboardListEl.innerHTML = "";
      const sortedPlayers = Object.entries(data.players)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 5);
      sortedPlayers.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `${player.name}: ${player.wins} wins, ${player.losses} losses, ${player.draws} draws`;
        leaderboardListEl.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

function renderBoard() {
  if (!gameState) return;

  boardEl.innerHTML = "";
  gameState.board.forEach((cell, index) => {
    const cellEl = document.createElement("div");
    cellEl.className = `cell ${cell === "X" ? "x" : cell === "O" ? "o" : ""}`;
    cellEl.textContent = cell === " " ? "" : cell;
    cellEl.setAttribute("role", "gridcell");
    cellEl.setAttribute("aria-label", cell === " " ? "Empty" : cell);
    cellEl.tabIndex = 0;

    if (!gameState.winner && !gameState.isDraw &&
        gameState.currentPlayer === playerSymbol &&
        cell === " ") {
      cellEl.onclick = () => makeMove(index);
      cellEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          makeMove(index);
        }
      };
      cellEl.style.cursor = "pointer";
    } else {
      cellEl.style.cursor = "default";
    }

    boardEl.appendChild(cellEl);
  });

  statusEl.classList.add("animate-bounce");
  setTimeout(() => statusEl.classList.remove("animate-bounce"), 500);

  if (gameState.winner) {
    statusEl.textContent = `Player ${gameState.winner} wins!`;
    statusEl.classList.add("text-yellow-300", "font-extrabold");
    stopPolling();
    winSound.play();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  } else if (gameState.isDraw) {
    statusEl.textContent = "It's a draw!";
    statusEl.classList.add("text-yellow-300", "font-extrabold");
    stopPolling();
    drawSound.play();
  } else {
    if (gameState.currentPlayer === playerSymbol) {
      statusEl.textContent = `Your turn (${playerSymbol})`;
      statusEl.classList.add("text-blue-300");
    } else {
      if (gameState.vsBot) {
        statusEl.textContent = "Bot is thinking...";
        statusEl.classList.add("text-purple-300");
      } else {
        statusEl.textContent = `Opponent's turn (${gameState.currentPlayer})`;
        statusEl.classList.add("text-purple-300");
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
      fetchLeaderboard();
    }
  } catch (error) {
    console.error('Error fetching game state:', error);
    statusEl.textContent = "Error fetching game state.";
    statusEl.classList.add("text-red-300");
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
      moveSound.play();
      renderBoard();
    } else {
      const error = await res.json();
      console.error('Move error:', error.error);
      statusEl.textContent = `Error: ${error.error}`;
      statusEl.classList.add("text-red-300");
    }
  } catch (error) {
    console.error('Error making move:', error);
    statusEl.textContent = "Error making move. Please try again.";
    statusEl.classList.add("text-red-300");
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
          statusEl.classList.add("text-green-300");
          nameEntryEl.classList.add("hidden");
          gameContainerEl.classList.remove("hidden");
          await fetchState();
          startPolling();
          return;
        } else {
          statusEl.textContent = "Waiting for opponent...";
          statusEl.classList.add("text-gray-200");
        }
      }
    } catch (e) {
      console.error("Error checking queue status", e);
      statusEl.textContent = "Error checking queue. Please try again.";
      statusEl.classList.add("text-red-300");
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
  playerName = null;

  nameEntryEl.classList.remove("hidden");
  gameContainerEl.classList.add("hidden");
  statusEl.textContent = "Enter your name to start.";
  statusEl.classList.add("text-gray-200");
  boardEl.innerHTML = "";
  playerNameInput.value = "";
  fetchLeaderboard();
}

async function joinGame() {
  const name = playerNameInput.value.trim();
  if (!name) {
    statusEl.textContent = "Please enter a name.";
    statusEl.classList.add("text-red-300");
    return;
  }

  try {
    const res = await fetch('/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();

    playerId = data.playerId;
    playerSymbol = data.symbol;
    playerName = name;

    if (data.gameId) {
      gameId = data.gameId;
      statusEl.textContent = "Game started!";
      statusEl.classList.add("text-green-300");
      nameEntryEl.classList.add("hidden");
      gameContainerEl.classList.remove("hidden");
      await fetchState();
      startPolling();
    } else {
      statusEl.textContent = "Waiting for opponent...";
      statusEl.classList.add("text-gray-200");
      waitForQueueMatch();
    }
  } catch (error) {
    console.error('Error starting game:', error);
    statusEl.textContent = "Error starting game. Please try again.";
    statusEl.classList.add("text-red-300");
  }
}

joinGameBtn.onclick = joinGame;

window.onload = () => {
  newGame();
};