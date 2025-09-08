// 2048 Game Logic
let board = [];
let score = 0;
let bestScore = localStorage.getItem("2048-best") || 0;
let hasWon = false;

function initGame() {
  board = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  score = 0;
  hasWon = false;
  document.getElementById("score").textContent = score;
  document.getElementById("best-score").textContent = bestScore;
  document.getElementById("game-message").style.display = "none";

  addNewTile();
  addNewTile();
  updateDisplay();
}

function addNewTile() {
  const emptyCells = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (board[i][j] === 0) {
        emptyCells.push({ row: i, col: j });
      }
    }
  }

  if (emptyCells.length > 0) {
    const randomCell =
      emptyCells[Math.floor(Math.random() * emptyCells.length)];
    board[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4;
  }
}

function updateDisplay() {
  const container = document.getElementById("grid-container");
  container.innerHTML = "";

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";

      if (board[i][j] !== 0) {
        const tile = document.createElement("div");
        tile.className = `tile tile-${board[i][j]}`;
        tile.textContent = board[i][j];
        cell.appendChild(tile);
      }

      container.appendChild(cell);
    }
  }

  document.getElementById("score").textContent = score;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("2048-best", bestScore);
    document.getElementById("best-score").textContent = bestScore;
  }
}

function move(direction) {
  let moved = false;
  const newBoard = board.map((row) => [...row]);

  if (direction === "left" || direction === "right") {
    for (let i = 0; i < 4; i++) {
      let row = newBoard[i];
      if (direction === "right") row = row.reverse();

      // Remove zeros
      row = row.filter((val) => val !== 0);

      // Merge tiles
      for (let j = 0; j < row.length - 1; j++) {
        if (row[j] === row[j + 1]) {
          row[j] *= 2;
          score += row[j];
          row[j + 1] = 0;

          if (row[j] === 2048 && !hasWon) {
            hasWon = true;
            showMessage("🎉 You Win! 🎉", "success");
          }
        }
      }

      // Remove zeros again
      row = row.filter((val) => val !== 0);

      // Add zeros to fill the row
      while (row.length < 4) {
        row.push(0);
      }

      if (direction === "right") row = row.reverse();

      // Check if this row changed
      for (let j = 0; j < 4; j++) {
        if (newBoard[i][j] !== row[j]) {
          moved = true;
        }
      }

      newBoard[i] = row;
    }
  } else {
    // up or down
    for (let j = 0; j < 4; j++) {
      let column = [];
      for (let i = 0; i < 4; i++) {
        column.push(newBoard[i][j]);
      }

      if (direction === "down") column = column.reverse();

      // Remove zeros
      column = column.filter((val) => val !== 0);

      // Merge tiles
      for (let i = 0; i < column.length - 1; i++) {
        if (column[i] === column[i + 1]) {
          column[i] *= 2;
          score += column[i];
          column[i + 1] = 0;

          if (column[i] === 2048 && !hasWon) {
            hasWon = true;
            showMessage("🎉 You Win! 🎉", "success");
          }
        }
      }

      // Remove zeros again
      column = column.filter((val) => val !== 0);

      // Add zeros to fill the column
      while (column.length < 4) {
        column.push(0);
      }

      if (direction === "down") column = column.reverse();

      // Check if this column changed
      for (let i = 0; i < 4; i++) {
        if (newBoard[i][j] !== column[i]) {
          moved = true;
        }
        newBoard[i][j] = column[i];
      }
    }
  }

  if (moved) {
    board = newBoard;
    addNewTile();
    updateDisplay();

    if (isGameOver()) {
      showMessage("💀 Game Over! 💀", "error");
    }
  }
}

function isGameOver() {
  // Check for empty cells
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (board[i][j] === 0) return false;
    }
  }

  // Check for possible merges
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const current = board[i][j];
      if (
        (i < 3 && board[i + 1][j] === current) ||
        (j < 3 && board[i][j + 1] === current)
      ) {
        return false;
      }
    }
  }

  return true;
}

function showMessage(text, type) {
  const messageEl = document.getElementById("game-message");
  messageEl.textContent = text;
  messageEl.style.display = "block";
  messageEl.style.color = type === "success" ? "#4CAF50" : "#f44336";
}

function newGame() {
  initGame();
}

// Keyboard controls
document.addEventListener("keydown", function (e) {
  e.preventDefault();
  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      move("left");
      break;
    case "ArrowRight":
    case "d":
    case "D":
      move("right");
      break;
    case "ArrowUp":
    case "w":
    case "W":
      move("up");
      break;
    case "ArrowDown":
    case "s":
    case "S":
      move("down");
      break;
  }
});

// Touch controls for mobile
let startX, startY;
const container = document.getElementById("grid-container");

container.addEventListener("touchstart", function (e) {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
});

container.addEventListener("touchend", function (e) {
  if (!startX || !startY) return;

  const endX = e.changedTouches[0].clientX;
  const endY = e.changedTouches[0].clientY;

  const diffX = startX - endX;
  const diffY = startY - endY;

  if (Math.abs(diffX) > Math.abs(diffY)) {
    // Horizontal swipe
    if (diffX > 0) {
      move("left");
    } else {
      move("right");
    }
  } else {
    // Vertical swipe
    if (diffY > 0) {
      move("up");
    } else {
      move("down");
    }
  }

  startX = null;
  startY = null;
});

// Initialize game
document.addEventListener("DOMContentLoaded", function () {
  initGame();
});
