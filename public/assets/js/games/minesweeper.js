// Minesweeper Game Logic
class Minesweeper {
  constructor() {
    this.difficulty = "easy";
    this.difficulties = {
      easy: { rows: 9, cols: 9, mines: 10 },
      medium: { rows: 16, cols: 16, mines: 40 },
      hard: { rows: 16, cols: 30, mines: 99 },
    };
    this.board = [];
    this.gameState = "playing"; // playing, won, lost
    this.mineCount = 0;
    this.revealedCount = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.firstClick = true;
    this.initGame();
  }

  initGame() {
    const config = this.difficulties[this.difficulty];
    this.rows = config.rows;
    this.cols = config.cols;
    this.totalMines = config.mines;
    this.mineCount = this.totalMines;
    this.revealedCount = 0;
    this.gameState = "playing";
    this.timer = 0;
    this.firstClick = true;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.createBoard();
    this.renderBoard();
    this.updateUI();
    this.updateBestTime();
  }

  createBoard() {
    this.board = [];
    for (let row = 0; row < this.rows; row++) {
      this.board[row] = [];
      for (let col = 0; col < this.cols; col++) {
        this.board[row][col] = {
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0,
        };
      }
    }
  }

  placeMines(firstClickRow, firstClickCol) {
    if (this.rows === 16 && this.cols === 30) {
      this.placeMinesWithGuaranteedEight(firstClickRow, firstClickCol);
    } else {
      this.placeMinesRegular(firstClickRow, firstClickCol);
    }
    this.calculateNeighborMines();
  }

  placeMinesRegular(firstClickRow, firstClickCol) {
    let minesPlaced = 0;
    while (minesPlaced < this.totalMines) {
      const row = Math.floor(Math.random() * this.rows);
      const col = Math.floor(Math.random() * this.cols);

      // Don't place mine on first click or if already has mine
      if (
        (row === firstClickRow && col === firstClickCol) ||
        this.board[row][col].isMine
      ) {
        continue;
      }

      this.board[row][col].isMine = true;
      minesPlaced++;
    }
  }

  placeMinesWithGuaranteedEight(firstClickRow, firstClickCol) {
    let eightSpaceRow, eightSpaceCol;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      eightSpaceRow = Math.floor(Math.random() * (this.rows - 2)) + 1;
      eightSpaceCol = Math.floor(Math.random() * (this.cols - 2)) + 1;
      attempts++;
    } while (
      attempts < maxAttempts &&
      Math.abs(eightSpaceRow - firstClickRow) <= 2 &&
      Math.abs(eightSpaceCol - firstClickCol) <= 2
    );

    let minesPlaced = 0;
    for (let r = eightSpaceRow - 1; r <= eightSpaceRow + 1; r++) {
      for (let c = eightSpaceCol - 1; c <= eightSpaceCol + 1; c++) {
        if (r !== eightSpaceRow || c !== eightSpaceCol) {
          if (r !== firstClickRow || c !== firstClickCol) {
            this.board[r][c].isMine = true;
            minesPlaced++;
          }
        }
      }
    }

    while (minesPlaced < this.totalMines) {
      const row = Math.floor(Math.random() * this.rows);
      const col = Math.floor(Math.random() * this.cols);

      if (
        (row === firstClickRow && col === firstClickCol) ||
        this.board[row][col].isMine ||
        (Math.abs(row - eightSpaceRow) <= 1 &&
          Math.abs(col - eightSpaceCol) <= 1)
      ) {
        continue;
      }

      this.board[row][col].isMine = true;
      minesPlaced++;
    }
  }

  calculateNeighborMines() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!this.board[row][col].isMine) {
          this.board[row][col].neighborMines = this.countNeighborMines(
            row,
            col
          );
        }
      }
    }
  }

  countNeighborMines(row, col) {
    let count = 0;
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (
          r >= 0 &&
          r < this.rows &&
          c >= 0 &&
          c < this.cols &&
          this.board[r][c].isMine
        ) {
          count++;
        }
      }
    }
    return count;
  }

  renderBoard() {
    const grid = document.getElementById("minesweeper-grid");
    grid.style.gridTemplateColumns = `repeat(${this.cols}, 30px)`;
    grid.innerHTML = "";

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Desktop controls
        cell.addEventListener("click", (e) =>
          this.handleCellClick(e, row, col)
        );
        cell.addEventListener("contextmenu", (e) =>
          this.handleRightClick(e, row, col)
        );

        // Mobile touch controls
        let touchStartTime = 0;
        let touchTimer = null;

        cell.addEventListener("touchstart", (e) => {
          e.preventDefault();
          touchStartTime = Date.now();
          // Long press to flag (500ms)
          touchTimer = setTimeout(() => {
            this.handleRightClick(e, row, col);
            // Add haptic feedback if available
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }, 500);
        });

        cell.addEventListener("touchend", (e) => {
          e.preventDefault();
          const touchDuration = Date.now() - touchStartTime;

          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }

          // Short tap to reveal (less than 500ms)
          if (touchDuration < 500) {
            this.handleCellClick(e, row, col);
          }
        });

        cell.addEventListener("touchcancel", (e) => {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
        });

        grid.appendChild(cell);
      }
    }
  }

  handleCellClick(e, row, col) {
    e.preventDefault();
    if (this.gameState !== "playing" || this.board[row][col].isFlagged) return;

    if (this.firstClick) {
      this.placeMines(row, col);
      this.firstClick = false;
      this.startTimer();
    }

    this.revealCell(row, col);
    this.updateUI();
    this.checkWinCondition();
  }

  handleRightClick(e, row, col) {
    e.preventDefault();
    if (this.gameState !== "playing" || this.board[row][col].isRevealed) return;

    this.board[row][col].isFlagged = !this.board[row][col].isFlagged;
    this.mineCount += this.board[row][col].isFlagged ? -1 : 1;
    this.updateCellDisplay(row, col);
    this.updateUI();
  }

  revealCell(row, col) {
    if (
      row < 0 ||
      row >= this.rows ||
      col < 0 ||
      col >= this.cols ||
      this.board[row][col].isRevealed ||
      this.board[row][col].isFlagged
    ) {
      return;
    }

    this.board[row][col].isRevealed = true;
    this.revealedCount++;
    this.updateCellDisplay(row, col);

    if (this.board[row][col].isMine) {
      this.gameState = "lost";
      this.revealAllMines();
      this.stopTimer();
      return;
    }

    // If empty cell, reveal neighbors
    if (this.board[row][col].neighborMines === 0) {
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          this.revealCell(r, c);
        }
      }
    }
  }

  updateCellDisplay(row, col) {
    const cell = document.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    );
    const cellData = this.board[row][col];

    cell.className = "cell";

    if (cellData.isFlagged) {
      cell.classList.add("flagged");
      cell.textContent = "🚩";
    } else if (cellData.isRevealed) {
      cell.classList.add("revealed");
      if (cellData.isMine) {
        cell.classList.add("mine");
        cell.textContent = "💣";
      } else if (cellData.neighborMines > 0) {
        cell.textContent = cellData.neighborMines;
        cell.classList.add(`number-${cellData.neighborMines}`);
      }
    } else {
      cell.textContent = "";
    }
  }

  revealAllMines() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cellData = this.board[row][col];
        const cell = document.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        );

        if (cellData.isMine) {
          cellData.isRevealed = true;

          if (cellData.isFlagged) {
            // Correctly flagged mine - show with golden highlight
            cell.className = "cell mine-flagged-correct";
            cell.textContent = "🚩";
          } else {
            // Unflagged mine - show with red background and bomb
            cell.className = "cell mine-unflagged";
            cell.textContent = "💣";
          }
        } else if (cellData.isFlagged) {
          // Incorrectly flagged cell (not a mine) - show with light red and crossed out flag
          cell.className = "cell flagged-incorrect";
          cell.textContent = "🚩";
        }
      }
    }
  }

  checkWinCondition() {
    const totalCells = this.rows * this.cols;
    if (this.revealedCount === totalCells - this.totalMines) {
      this.gameState = "won";
      this.stopTimer();
      this.celebrateWin();
    }
  }

  celebrateWin() {
    // Add celebration effects to all revealed cells
    const cells = document.querySelectorAll(".cell.revealed");
    cells.forEach((cell, index) => {
      setTimeout(() => {
        cell.style.background = "linear-gradient(45deg, #4CAF50, #81C784)";
        cell.style.color = "white";
        cell.style.animation = "winCelebration 0.6s ease-in-out";
      }, index * 20); // Staggered animation
    });

    // Show all mine locations after celebration (2 seconds delay)
    setTimeout(() => {
      this.showAllMinesOnWin();
    }, 2000);

    // Save best time if it's a new record
    const bestTimeKey = `minesweeper-best-${this.difficulty}`;
    const currentBest = localStorage.getItem(bestTimeKey);

    if (!currentBest || this.timer < parseInt(currentBest)) {
      localStorage.setItem(bestTimeKey, this.timer.toString());
      this.updateBestTime();
      setTimeout(() => {
        const messageEl = document.getElementById("status-message");
        messageEl.innerHTML += "<br><small>🏆 New Best Time!</small>";
      }, 1000);
    }

    // Play celebration sound
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b9xWgdBiaN2+/DCSQHIX/E9N+VQgoVX7bk6qpZFwoMnrPj+MlhGAQfidb3w3gkBSl+zO/EGSUEInTE8d2QQAsTXLPq6atWFAoNn7Ps+8kkBSN8yOzfJSUIHw=="
      );
      audio.play();
    } catch (e) {
      // Audio not available, continue without sound
    }
  }

  showAllMinesOnWin() {
    // Show all mine locations when game is won (gentler visualization)
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cellData = this.board[row][col];
        const cell = document.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        );

        if (cellData.isMine && cellData.isFlagged) {
          // Correctly flagged mine - show with gentle golden glow
          cell.style.boxShadow = "0 0 15px rgba(255, 215, 0, 0.8)";
          cell.style.border = "2px solid #ffd700";
        } else if (cellData.isMine && !cellData.isFlagged) {
          // Unflagged mine - show with subtle indicator
          const mineIndicator = document.createElement("div");
          mineIndicator.textContent = "💣";
          mineIndicator.style.position = "absolute";
          mineIndicator.style.fontSize = "0.8em";
          mineIndicator.style.opacity = "0.7";
          mineIndicator.style.top = "2px";
          mineIndicator.style.right = "2px";
          cell.style.position = "relative";
          cell.appendChild(mineIndicator);
        }
      }
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timer++;
      document.getElementById("timer").textContent = this.timer;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  updateUI() {
    document.getElementById("mine-count").textContent = this.mineCount;
    document.getElementById("timer").textContent = this.timer;

    const statusEl = document.getElementById("game-status");
    const messageEl = document.getElementById("status-message");

    switch (this.gameState) {
      case "playing":
        statusEl.textContent = "Playing";
        messageEl.textContent = "";
        messageEl.className = "game-status";
        break;
      case "won":
        statusEl.textContent = "Won!";
        messageEl.textContent = "🎉 Congratulations! You cleared all mines!";
        messageEl.className = "game-status win";
        messageEl.style.animation = "winPulse 2s infinite";

        // Show final stats
        setTimeout(() => {
          messageEl.innerHTML += `<br><small>Time: ${this.timer}s | Difficulty: ${this.difficulty}</small>`;
          messageEl.innerHTML += `<br><small>💎 Gold highlights show correctly flagged mines</small>`;
        }, 500);
        break;
      case "lost":
        statusEl.textContent = "Lost";
        messageEl.textContent = "💥 Game Over! You hit a mine!";
        messageEl.className = "game-status lose";
        messageEl.style.animation = "shake 0.5s ease-in-out";

        // Add explanation of visual feedback after a short delay
        setTimeout(() => {
          messageEl.innerHTML += `<br><small>💎 Gold = Correct flags | ❌ Crossed flags = Wrong flags | 💣 Red = Unflagged mines</small>`;
        }, 1000);
        break;
    }
  }

  updateBestTime() {
    const bestTimeKey = `minesweeper-best-${this.difficulty}`;
    const bestTime = localStorage.getItem(bestTimeKey);
    const bestTimeEl = document.getElementById("best-time");
    
    if (bestTime) {
      bestTimeEl.textContent = `${bestTime}s`;
      bestTimeEl.style.color = "#ffd700"; // Gold color for best time
    } else {
      bestTimeEl.textContent = "--";
      bestTimeEl.style.color = "";
    }
  }

  changeDifficulty(newDifficulty) {
    this.difficulty = newDifficulty;
    this.initGame();
  }
}

// Initialize game and global functions
let game;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  game = new Minesweeper();
});

function newGame() {
  const difficulty = document.getElementById("difficulty").value;
  game.changeDifficulty(difficulty);
}

// Event listeners
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("difficulty").addEventListener("change", (e) => {
    game.changeDifficulty(e.target.value);
  });
});
