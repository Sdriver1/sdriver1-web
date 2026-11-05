// 2048 Game Logic
const SIZE = 4;

let board = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem("2048-best") || "0", 10);
let hasWon = false;
let gameOver = false;
// One level of undo — snapshot taken before each successful move
let undoState = null;
// Stable ids let the renderer animate a tile from its old cell to its new one
let tileId = 0;
let tiles = [];

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function initGame() {
  board = emptyBoard();
  tiles = [];
  score = 0;
  hasWon = false;
  gameOver = false;
  undoState = null;
  tileId = 0;

  document.getElementById("score").textContent = score;
  document.getElementById("best-score").textContent = bestScore;
  document.getElementById("game-message").style.display = "none";
  setUndoEnabled(false);

  addNewTile();
  addNewTile();
  updateDisplay();
}

function addNewTile() {
  const emptyCells = [];
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (board[i][j] === 0) emptyCells.push({ row: i, col: j });
    }
  }
  if (emptyCells.length === 0) return;

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  board[cell.row][cell.col] = value;
  tiles.push({
    id: ++tileId,
    row: cell.row,
    col: cell.col,
    value,
    isNew: true,
    merged: false,
  });
}

function snapshot() {
  return {
    board: board.map((row) => [...row]),
    tiles: tiles.map((t) => ({ ...t })),
    score,
    hasWon,
    tileId,
  };
}

function restore(state) {
  board = state.board.map((row) => [...row]);
  tiles = state.tiles.map((t) => ({ ...t, isNew: false, merged: false }));
  score = state.score;
  hasWon = state.hasWon;
  tileId = state.tileId;
  gameOver = false;
}

function undo() {
  if (!undoState) return;
  restore(undoState);
  undoState = null;
  setUndoEnabled(false);
  document.getElementById("game-message").style.display = "none";
  updateDisplay();
}

// --- Rendering -------------------------------------------------------------
// The 16 background cells are laid out once and never rebuilt; tiles are
// absolutely positioned on top so CSS transitions can slide them.
function buildGrid() {
  const container = document.getElementById("grid-container");
  container.innerHTML = "";

  const background = document.createElement("div");
  background.className = "grid-background";
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    background.appendChild(cell);
  }
  container.appendChild(background);

  const layer = document.createElement("div");
  layer.className = "tile-layer";
  layer.id = "tile-layer";
  container.appendChild(layer);
}

function updateDisplay(absorbed = []) {
  const layer = document.getElementById("tile-layer");
  const seen = new Set();

  // Absorbed tiles slide to their merge target, then get pulled from the DOM
  absorbed.forEach((t) => {
    const el = layer.querySelector(`[data-tile-id="${t.id}"]`);
    if (!el) return;
    seen.add(t.id);
    setTilePosition(el, t.row, t.col);
    el.classList.add("tile-absorbed");
    setTimeout(() => el.remove(), 160);
  });

  tiles.forEach((t) => {
    seen.add(t.id);
    let el = layer.querySelector(`[data-tile-id="${t.id}"]`);

    if (!el) {
      el = document.createElement("div");
      el.dataset.tileId = t.id;
      el.className = `tile tile-${t.value}`;
      el.textContent = t.value;
      setTilePosition(el, t.row, t.col);
      layer.appendChild(el);
      // Let the browser paint at the start position before animating in
      requestAnimationFrame(() => el.classList.add("tile-appear"));
    } else {
      // Keep tile-appear: reassigning className would drop it, and
      // `.tile:not(.tile-appear)` is the hidden spawn state.
      el.className = `tile tile-${t.value} tile-appear`;
      el.textContent = t.value;
      setTilePosition(el, t.row, t.col);
      if (t.merged) {
        el.classList.remove("tile-merged");
        // Restart the pop animation on a merge
        void el.offsetWidth;
        el.classList.add("tile-merged");
      }
    }
    t.isNew = false;
    t.merged = false;
  });

  // Anything left over (e.g. after an undo) is stale — drop it immediately
  layer.querySelectorAll(".tile").forEach((el) => {
    if (!seen.has(Number(el.dataset.tileId))) el.remove();
  });

  document.getElementById("score").textContent = score;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("2048-best", String(bestScore));
    document.getElementById("best-score").textContent = bestScore;
  }
}

// #undo-btn is new in this redesign; tolerate a cached page without it
function setUndoEnabled(enabled) {
  const btn = document.getElementById("undo-btn");
  if (btn) btn.disabled = !enabled;
}

function setTilePosition(el, row, col) {
  el.style.setProperty("--row", row);
  el.style.setProperty("--col", col);
}

// --- Movement --------------------------------------------------------------
// Each line is collapsed with its tiles carried along, so the renderer knows
// where every tile came from.
function collapseLine(line) {
  const filtered = line.filter((t) => t !== null);
  const result = [];
  let gained = 0;
  let reached2048 = false;

  for (let i = 0; i < filtered.length; i++) {
    const current = filtered[i];
    const next = filtered[i + 1];
    if (next && current.value === next.value) {
      const value = current.value * 2;
      gained += value;
      if (value === 2048) reached2048 = true;
      // Keep the first tile's id and mark the second as absorbed
      result.push({ tile: current, absorbs: next, value, merged: true });
      i++; // skip the tile we just merged in
    } else {
      result.push({ tile: current, absorbs: null, value: current.value, merged: false });
    }
  }

  while (result.length < SIZE) result.push(null);
  return { result, gained, reached2048 };
}

function move(direction) {
  if (gameOver) return;

  const before = snapshot();
  const grid = emptyBoard();
  const tileAt = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  tiles.forEach((t) => {
    tileAt[t.row][t.col] = t;
  });

  const survivors = [];
  const absorbed = [];
  let moved = false;
  let gainedTotal = 0;
  let reached2048 = false;

  const isVertical = direction === "up" || direction === "down";
  const isReversed = direction === "right" || direction === "down";

  for (let line = 0; line < SIZE; line++) {
    // Read the row/column in travel order: index 0 is nearest the wall the
    // tiles are sliding toward, so collapsing is always "toward index 0".
    const cells = [];
    for (let i = 0; i < SIZE; i++) {
      const row = isVertical ? i : line;
      const col = isVertical ? line : i;
      cells.push({ row, col, tile: tileAt[row][col] });
    }
    if (isReversed) cells.reverse();

    const collapsed = collapseLine(cells.map((c) => c.tile));
    gainedTotal += collapsed.gained;
    if (collapsed.reached2048) reached2048 = true;

    for (let i = 0; i < SIZE; i++) {
      const entry = collapsed.result[i];
      if (!entry) continue;

      const target = cells[i];
      if (entry.tile.row !== target.row || entry.tile.col !== target.col) {
        moved = true;
      }
      if (entry.absorbs) {
        moved = true;
        // Slide the absorbed tile onto the same cell so it disappears under
        // the survivor rather than vanishing from where it started.
        entry.absorbs.row = target.row;
        entry.absorbs.col = target.col;
        absorbed.push(entry.absorbs);
      }

      entry.tile.row = target.row;
      entry.tile.col = target.col;
      entry.tile.value = entry.value;
      entry.tile.merged = entry.merged;
      grid[target.row][target.col] = entry.value;
      survivors.push(entry.tile);
    }
  }

  if (!moved) {
    // Nothing shifted — put the tiles back exactly as they were
    restore(before);
    return;
  }

  board = grid;
  tiles = survivors;
  score += gainedTotal;

  undoState = before;
  setUndoEnabled(true);

  addNewTile();
  updateDisplay(absorbed);

  if (reached2048 && !hasWon) {
    hasWon = true;
    showMessage("🎉 You Win! Keep going for a higher score.", "success");
  } else if (isGameOver()) {
    gameOver = true;
    showMessage("💀 Game Over! 💀", "error");
  }
}

function isGameOver() {
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (board[i][j] === 0) return false;
    }
  }
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const current = board[i][j];
      if (
        (i < SIZE - 1 && board[i + 1][j] === current) ||
        (j < SIZE - 1 && board[i][j + 1] === current)
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
  messageEl.className = `game-message ${type === "success" ? "win" : "lose"}`;
}

function newGame() {
  initGame();
}

// --- Input -----------------------------------------------------------------
const KEY_MOVES = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
};

document.addEventListener("keydown", function (e) {
  // Leave modified keystrokes and form fields alone
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;

  if ((e.key === "z" || e.key === "Z") && undoState) {
    e.preventDefault();
    undo();
    return;
  }

  const direction = KEY_MOVES[e.key];
  if (!direction) return; // don't swallow Tab, F5, typing, etc.
  e.preventDefault();
  move(direction);
});

// Touch controls for mobile
let startX = null;
let startY = null;

function bindTouch() {
  const container = document.getElementById("grid-container");

  container.addEventListener(
    "touchstart",
    function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  container.addEventListener("touchend", function (e) {
    if (startX === null || startY === null) return;

    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;
    startX = null;
    startY = null;

    // Ignore incidental taps
    if (Math.abs(diffX) < 25 && Math.abs(diffY) < 25) return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      move(diffX > 0 ? "right" : "left");
    } else {
      move(diffY > 0 ? "down" : "up");
    }
  });
}

// Initialize game
document.addEventListener("DOMContentLoaded", function () {
  buildGrid();
  bindTouch();
  const undoBtn = document.getElementById("undo-btn");
  if (undoBtn) undoBtn.addEventListener("click", undo);
  initGame();
});
