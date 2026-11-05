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
    this.cellEls = []; // cached DOM nodes, keyed [row][col]
    this.gameState = "playing"; // playing, won, lost
    this.mineCount = 0;
    this.revealedCount = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.firstClick = true;
    this.flagMode = false;
    this.newBestPending = false;
    this.suppressClick = false;
    this.eventsBound = false;
    // Bumped on every new game so stale timeouts from the last one bail out
    this.round = 0;
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
    this.newBestPending = false;
    this.suppressClick = false;
    if (!flagModeAvailable()) this.flagMode = false;
    this.round++;

    this.stopTimer();
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

  // Walks the up-to-eight neighbours of a cell
  forEachNeighbor(row, col, fn) {
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r === row && c === col) continue;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        fn(r, c, this.board[r][c]);
      }
    }
  }

  placeMines(firstClickRow, firstClickCol) {
    // Keep the first click AND its neighbours clear, so the opening click
    // always cascades instead of dumping you on a number.
    const safe = new Set();
    safe.add(`${firstClickRow},${firstClickCol}`);
    this.forEachNeighbor(firstClickRow, firstClickCol, (r, c) => {
      safe.add(`${r},${c}`);
    });

    // On a dense board that safe patch may not leave room for every mine;
    // shrink it to just the clicked cell if so.
    const available = this.rows * this.cols - safe.size;
    const useFullSafeZone = available >= this.totalMines;

    let minesPlaced = 0;
    while (minesPlaced < this.totalMines) {
      const row = Math.floor(Math.random() * this.rows);
      const col = Math.floor(Math.random() * this.cols);
      const key = `${row},${col}`;

      if (this.board[row][col].isMine) continue;
      if (useFullSafeZone && safe.has(key)) continue;
      if (!useFullSafeZone && row === firstClickRow && col === firstClickCol) {
        continue;
      }

      this.board[row][col].isMine = true;
      minesPlaced++;
    }

    this.calculateNeighborMines();
  }

  calculateNeighborMines() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.board[row][col].isMine) continue;
        let count = 0;
        this.forEachNeighbor(row, col, (r, c, cell) => {
          if (cell.isMine) count++;
        });
        this.board[row][col].neighborMines = count;
      }
    }
  }

  renderBoard() {
    const grid = document.getElementById("minesweeper-grid");
    // Cell size is a CSS variable so the board can shrink on narrow screens
    grid.style.setProperty("--cols", this.cols);
    grid.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
    grid.innerHTML = "";
    this.cellEls = [];

    const fragment = document.createDocumentFragment();

    for (let row = 0; row < this.rows; row++) {
      this.cellEls[row] = [];
      for (let col = 0; col < this.cols; col++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = row;
        cell.dataset.col = col;
        this.cellEls[row][col] = cell;
        fragment.appendChild(cell);
      }
    }

    grid.appendChild(fragment);

    // Bind exactly once. These are delegated listeners on #minesweeper-grid,
    // which survives re-renders — rebinding per game stacked up handlers, so a
    // right-click toggled the flag N times and appeared to do nothing.
    if (!this.eventsBound) {
      this.bindGridEvents(grid);
      this.eventsBound = true;
    }
  }

  // One delegated listener per event type instead of four per cell
  bindGridEvents(grid) {
    const coordsFrom = (target) => {
      const cell = target.closest(".cell");
      if (!cell || !grid.contains(cell)) return null;
      return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    };

    grid.addEventListener("mousedown", (e) => {
      const at = coordsFrom(e.target);
      if (!at) return;
      // Middle click, or left+right together, chords
      if (e.button === 1 || (e.buttons & 3) === 3) {
        e.preventDefault();
        // Releasing the buttons fires a click too — don't let it reveal
        this.suppressClick = true;
        this.chord(at.row, at.col);
      }
    });

    grid.addEventListener("click", (e) => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      const at = coordsFrom(e.target);
      if (!at) return;
      if (this.flagMode) {
        this.toggleFlag(at.row, at.col);
      } else if (this.board[at.row][at.col].isRevealed) {
        // Clicking a satisfied number clears its neighbours
        this.chord(at.row, at.col);
      } else {
        this.reveal(at.row, at.col);
      }
    });

    grid.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const at = coordsFrom(e.target);
      if (!at) return;
      this.toggleFlag(at.row, at.col);
    });

    // --- touch: tap reveals, long press flags, double tap chords
    let touchTimer = null;
    let touchStart = 0;
    let longPressed = false;

    grid.addEventListener(
      "touchstart",
      (e) => {
        const at = coordsFrom(e.target);
        if (!at) return;
        touchStart = Date.now();
        longPressed = false;
        touchTimer = setTimeout(() => {
          longPressed = true;
          this.toggleFlag(at.row, at.col);
          if (navigator.vibrate) navigator.vibrate(40);
        }, 450);
      },
      { passive: true }
    );

    grid.addEventListener("touchend", (e) => {
      const at = coordsFrom(e.target);
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
      if (!at || longPressed) return;
      e.preventDefault();

      if (Date.now() - touchStart < 450) {
        if (this.flagMode) {
          this.toggleFlag(at.row, at.col);
        } else if (this.board[at.row][at.col].isRevealed) {
          this.chord(at.row, at.col);
        } else {
          this.reveal(at.row, at.col);
        }
      }
    });

    grid.addEventListener("touchcancel", () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    });
  }

  reveal(row, col) {
    if (this.gameState !== "playing") return;
    if (this.board[row][col].isFlagged) return;

    if (this.firstClick) {
      this.placeMines(row, col);
      this.firstClick = false;
      this.startTimer();
    }

    this.revealCell(row, col);
    this.updateUI();
    this.checkWinCondition();
  }

  toggleFlag(row, col) {
    if (this.gameState !== "playing" || this.board[row][col].isRevealed) return;

    this.board[row][col].isFlagged = !this.board[row][col].isFlagged;
    this.mineCount += this.board[row][col].isFlagged ? -1 : 1;
    this.updateCellDisplay(row, col);
    this.updateUI();
  }

  // Reveal every unflagged neighbour of a number whose flag count matches it.
  chord(row, col) {
    if (this.gameState !== "playing") return;
    const cell = this.board[row][col];
    if (!cell.isRevealed || cell.neighborMines === 0) return;

    let flagged = 0;
    this.forEachNeighbor(row, col, (r, c, n) => {
      if (n.isFlagged) flagged++;
    });
    if (flagged !== cell.neighborMines) return;

    this.forEachNeighbor(row, col, (r, c, n) => {
      if (!n.isFlagged && !n.isRevealed) this.revealCell(r, c);
    });

    this.updateUI();
    this.checkWinCondition();
  }

  // Iterative flood fill — recursion blew past comfortable depths on hard
  revealCell(startRow, startCol) {
    const stack = [[startRow, startCol]];

    while (stack.length) {
      const [row, col] = stack.pop();
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;

      const cell = this.board[row][col];
      if (cell.isRevealed || cell.isFlagged) continue;

      cell.isRevealed = true;
      this.revealedCount++;
      this.updateCellDisplay(row, col);

      if (cell.isMine) {
        this.gameState = "lost";
        this.revealAllMines();
        this.stopTimer();
        return;
      }

      if (cell.neighborMines === 0) {
        this.forEachNeighbor(row, col, (r, c) => stack.push([r, c]));
      }
    }
  }

  updateCellDisplay(row, col) {
    const cell = this.cellEls[row][col];
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
      } else {
        cell.textContent = "";
      }
    } else {
      cell.textContent = "";
    }
  }

  revealAllMines() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cellData = this.board[row][col];
        const cell = this.cellEls[row][col];

        if (cellData.isMine) {
          cellData.isRevealed = true;
          if (cellData.isFlagged) {
            cell.className = "cell mine-flagged-correct";
            cell.textContent = "🚩";
          } else {
            cell.className = "cell mine-unflagged";
            cell.textContent = "💣";
          }
        } else if (cellData.isFlagged) {
          cell.className = "cell flagged-incorrect";
          cell.textContent = "🚩";
        }
      }
    }
  }

  checkWinCondition() {
    if (this.gameState !== "playing") return;
    const totalCells = this.rows * this.cols;
    if (this.revealedCount === totalCells - this.totalMines) {
      this.gameState = "won";
      this.stopTimer();
      this.celebrateWin();
    }
  }

  celebrateWin() {
    const round = this.round;

    // Flag every remaining mine for the player — the board is solved
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cellData = this.board[row][col];
        if (cellData.isMine && !cellData.isFlagged) {
          cellData.isFlagged = true;
          this.updateCellDisplay(row, col);
        }
      }
    }
    this.mineCount = 0;

    // Ripple the celebration out from the top-left
    const cells = this.cellEls.flat().filter((c) => c.classList.contains("revealed"));
    cells.forEach((cell, index) => {
      setTimeout(() => {
        if (this.round !== round) return; // a new game started, drop this
        cell.classList.add("celebrate");
      }, index * 8);
    });

    const bestTimeKey = `minesweeper-best-${this.difficulty}`;
    const currentBest = parseInt(localStorage.getItem(bestTimeKey) || "0", 10);
    const isBest = !currentBest || this.timer < currentBest;

    if (isBest) {
      localStorage.setItem(bestTimeKey, String(this.timer));
      this.updateBestTime();
    }
    this.newBestPending = isBest;

    // reveal()/chord() already called updateUI before the win was known
    this.updateUI();
  }

  startTimer() {
    this.stopTimer();
    const started = Date.now();
    this.timerInterval = setInterval(() => {
      this.timer = Math.floor((Date.now() - started) / 1000);
      setText("timer", formatTime(this.timer));
    }, 250);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateUI() {
    setText("mine-count", this.mineCount);
    setText("timer", formatTime(this.timer));

    const statusEl = el("game-status");
    const messageEl = el("status-message");
    if (!statusEl || !messageEl) return;

    switch (this.gameState) {
      case "playing":
        statusEl.textContent = "Playing";
        messageEl.textContent = "";
        messageEl.className = "game-status";
        break;
      case "won": {
        statusEl.textContent = "Won!";
        messageEl.className = "game-status win";
        const best = this.newBestPending ? " 🏆 New best time!" : "";
        messageEl.innerHTML =
          "🎉 Congratulations! You cleared all mines!" +
          `<br><small>Time: ${formatTime(this.timer)} &middot; ${this.difficulty}${best}</small>`;
        break;
      }
      case "lost":
        statusEl.textContent = "Lost";
        messageEl.className = "game-status lose";
        messageEl.innerHTML =
          "💥 Game Over! You hit a mine!" +
          "<br><small>💎 Gold = correct flags &middot; ❌ crossed = wrong flags &middot; 💣 red = missed mines</small>";
        break;
    }
  }

  updateBestTime() {
    const bestTimeKey = `minesweeper-best-${this.difficulty}`;
    const bestTime = parseInt(localStorage.getItem(bestTimeKey) || "0", 10);
    const bestTimeEl = el("best-time");
    if (!bestTimeEl) return;

    if (bestTime) {
      bestTimeEl.textContent = formatTime(bestTime);
      bestTimeEl.classList.add("has-best");
    } else {
      bestTimeEl.textContent = "--:--";
      bestTimeEl.classList.remove("has-best");
    }
  }

  toggleFlagMode() {
    this.flagMode = !this.flagMode;
    const btn = el("flag-mode-btn");
    if (btn) {
      btn.classList.toggle("active", this.flagMode);
      btn.setAttribute("aria-pressed", String(this.flagMode));
    }
    setText("flag-mode-state", this.flagMode ? "Flag" : "Reveal");
  }

  changeDifficulty(newDifficulty) {
    this.difficulty = newDifficulty;
    this.newBestPending = false;
    this.initGame();
  }
}

// Elements introduced by the redesign; a browser holding an hour-old cached
// page won't have them, so every lookup has to tolerate null.
function el(id) {
  return document.getElementById(id);
}

// Mirrors the `(any-pointer: coarse)` rule in minesweeper.css — flag mode is a
// touch affordance, so on a mouse-only machine there is no button, no status
// readout, and no F shortcut to toggle something the user can't see.
function flagModeAvailable() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(any-pointer: coarse)").matches
  );
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Initialize game and global functions
let game;

function newGame() {
  const select = el("difficulty");
  game.changeDifficulty(select ? select.value : game.difficulty);
}

document.addEventListener("DOMContentLoaded", function () {
  game = new Minesweeper();

  const difficultySelect = el("difficulty");
  if (difficultySelect) {
    difficultySelect.addEventListener("change", (e) => {
      game.changeDifficulty(e.target.value);
    });
  }

  const flagBtn = el("flag-mode-btn");
  if (flagBtn) {
    flagBtn.addEventListener("click", () => game.toggleFlagMode());
  }
  const canFlagMode = flagModeAvailable();

  // F toggles flag mode, R starts a new game
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "select" || tag === "input" || tag === "textarea") return;

    if ((e.key === "f" || e.key === "F") && canFlagMode) {
      e.preventDefault();
      game.toggleFlagMode();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      newGame();
    }
  });
});
