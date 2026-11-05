// Sudoku Game Logic
const N = 9;

let currentGrid = []; // player-visible state, 0 = empty
let givenGrid = []; // the starting clues, used to lock cells
let solution = []; // one valid solution (puzzles are generated unique)
let notes = []; // Set of pencilled candidates per cell
let selected = { row: 0, col: 0 };
let noteMode = false;
let hintsUsed = 0;
let solved = false;

let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

// Target number of givens. Anything below ~24 can't be generated quickly with
// a uniqueness check, so expert sits at 25 rather than the theoretical 17.
const difficulties = {
  easy: 45,
  medium: 36,
  hard: 30,
  expert: 25,
};

let currentDifficulty = "easy";

// Several controls are new in this redesign (number pad, notes, hint counter);
// a browser on a cached page won't have them, so guard every lookup.
function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value;
}

// --- Grid helpers ----------------------------------------------------------
function createEmptyGrid() {
  return Array.from({ length: N }, () => Array(N).fill(0));
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

// Can `num` go at (row, col)? Ignores whatever is already in that cell.
function isValid(grid, row, col, num) {
  for (let x = 0; x < N; x++) {
    if (x !== col && grid[row][x] === num) return false;
    if (x !== row && grid[x][col] === num) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const r = startRow + i;
      const c = startCol + j;
      if ((r !== row || c !== col) && grid[r][c] === num) return false;
    }
  }
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Generation ------------------------------------------------------------
function fillGrid(grid) {
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (grid[row][col] !== 0) continue;
      for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (isValid(grid, row, col, num)) {
          grid[row][col] = num;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

// Counts solutions, bailing out as soon as we find `limit` of them. Picks the
// most-constrained cell first, which keeps the search cheap enough to run
// after every candidate removal.
function countSolutions(grid, limit = 2) {
  let bestRow = -1;
  let bestCol = -1;
  let bestCandidates = null;

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (grid[row][col] !== 0) continue;
      const candidates = [];
      for (let num = 1; num <= 9; num++) {
        if (isValid(grid, row, col, num)) candidates.push(num);
      }
      if (candidates.length === 0) return 0; // dead end
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestRow = row;
        bestCol = col;
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (bestCandidates && bestCandidates.length === 1) break;
  }

  if (!bestCandidates) return 1; // grid is full

  let total = 0;
  for (const num of bestCandidates) {
    grid[bestRow][bestCol] = num;
    total += countSolutions(grid, limit - total);
    grid[bestRow][bestCol] = 0;
    if (total >= limit) break;
  }
  return total;
}

// Pure: returns { puzzle, solution }. Kept free of module state so its source
// can be handed to a worker with Function.prototype.toString().
function generatePuzzle(difficulty, targetGivens) {
  const complete = createEmptyGrid();
  fillGrid(complete);
  const solved = cloneGrid(complete);

  const puzzle = cloneGrid(complete);

  // Remove clues one at a time, keeping only removals that leave the puzzle
  // with exactly one solution.
  const positions = shuffle(
    Array.from({ length: N * N }, (_, i) => [Math.floor(i / N), i % N])
  );

  let givens = N * N;
  for (const [row, col] of positions) {
    if (givens <= targetGivens) break;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(cloneGrid(puzzle), 2) !== 1) {
      puzzle[row][col] = backup; // removal made it ambiguous, keep the clue
    } else {
      givens--;
    }
  }

  return { puzzle, solution: solved };
}

// --- Generation off the main thread ----------------------------------------
// Expert puzzles can take a couple of seconds to generate because every clue
// removal re-runs the solver. Doing that inline froze the page, so the work
// goes to a worker assembled from the very same functions.
let generatorWorker = null; // null = not built yet, false = unavailable

function createGeneratorWorker() {
  try {
    const source = [
      "const N = " + N + ";",
      createEmptyGrid.toString(),
      cloneGrid.toString(),
      isValid.toString(),
      shuffle.toString(),
      fillGrid.toString(),
      countSolutions.toString(),
      generatePuzzle.toString(),
      "self.onmessage = function (e) {" +
        "var d = e.data;" +
        "var r = generatePuzzle(d.difficulty, d.targetGivens);" +
        "self.postMessage({ token: d.token, puzzle: r.puzzle, solution: r.solution });" +
        "};",
    ].join("\n");
    const blob = new Blob([source], { type: "application/javascript" });
    return new Worker(URL.createObjectURL(blob));
  } catch (err) {
    // Blob workers blocked (strict CSP, file://) — fall back to inline work
    console.warn("Sudoku: worker unavailable, generating on main thread", err);
    return null;
  }
}

// Guards against a stale puzzle landing after the player switched difficulty
let generationToken = 0;

function requestPuzzle(difficulty, onReady) {
  const targetGivens = difficulties[difficulty];
  const token = ++generationToken;

  if (generatorWorker === null) {
    generatorWorker = createGeneratorWorker() || false;
  }

  if (!generatorWorker) {
    onReady(generatePuzzle(difficulty, targetGivens));
    return;
  }

  generatorWorker.onmessage = (e) => {
    if (e.data.token !== generationToken) return; // superseded by a newer game
    onReady({ puzzle: e.data.puzzle, solution: e.data.solution });
  };
  generatorWorker.onerror = (err) => {
    console.warn("Sudoku: worker failed, generating on main thread", err);
    generatorWorker = false; // don't retry the worker path
    onReady(generatePuzzle(difficulty, targetGivens));
  };
  generatorWorker.postMessage({ difficulty, targetGivens, token });
}

// --- Rendering -------------------------------------------------------------
let cellEls = [];

function buildGrid() {
  const gridElement = document.getElementById("sudoku-grid");
  gridElement.innerHTML = "";
  cellEls = [];

  for (let row = 0; row < N; row++) {
    cellEls[row] = [];
    for (let col = 0; col < N; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sudoku-cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);

      const value = document.createElement("span");
      value.className = "cell-value";
      cell.appendChild(value);

      const noteWrap = document.createElement("span");
      noteWrap.className = "cell-notes";
      for (let n = 1; n <= 9; n++) {
        const note = document.createElement("span");
        note.className = "cell-note";
        note.dataset.note = n;
        noteWrap.appendChild(note);
      }
      cell.appendChild(noteWrap);

      cell.addEventListener("click", () => selectCell(row, col));

      cellEls[row][col] = cell;
      gridElement.appendChild(cell);
    }
  }
}

function renderGrid() {
  // Conflicts are recomputed from the whole board every render, so a number
  // typed earlier still lights up when a later entry collides with it.
  const conflicts = findConflicts();
  const selectedValue = currentGrid[selected.row][selected.col];

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const cell = cellEls[row][col];
      const value = currentGrid[row][col];
      const isGiven = givenGrid[row][col] !== 0;

      cell.classList.toggle("given", isGiven);
      cell.classList.toggle("conflict", conflicts[row][col]);
      cell.classList.toggle("selected", row === selected.row && col === selected.col);
      cell.classList.toggle(
        "peer",
        !(row === selected.row && col === selected.col) &&
          (row === selected.row ||
            col === selected.col ||
            (Math.floor(row / 3) === Math.floor(selected.row / 3) &&
              Math.floor(col / 3) === Math.floor(selected.col / 3)))
      );
      // Highlight every copy of the selected number
      cell.classList.toggle(
        "same-value",
        value !== 0 && value === selectedValue
      );

      const valueEl = cell.querySelector(".cell-value");
      valueEl.textContent = value === 0 ? "" : value;

      const noteEls = cell.querySelectorAll(".cell-note");
      const cellNotes = notes[row][col];
      const showNotes = value === 0 && cellNotes.size > 0;
      cell.classList.toggle("has-notes", showNotes);
      noteEls.forEach((el) => {
        const n = Number(el.dataset.note);
        el.textContent = showNotes && cellNotes.has(n) ? n : "";
      });
    }
  }

  updateNumberPadCounts();
}

// Returns a 9x9 boolean grid marking every filled cell that clashes with
// another filled cell in its row, column, or box.
function findConflicts() {
  const conflicts = Array.from({ length: N }, () => Array(N).fill(false));
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const value = currentGrid[row][col];
      if (value === 0) continue;
      if (!isValid(currentGrid, row, col, value)) conflicts[row][col] = true;
    }
  }
  return conflicts;
}

function updateNumberPadCounts() {
  const counts = Array(10).fill(0);
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const v = currentGrid[row][col];
      if (v) counts[v]++;
    }
  }
  document.querySelectorAll(".num-btn[data-number]").forEach((btn) => {
    const n = Number(btn.dataset.number);
    // Grey out numbers that are already placed nine times
    btn.classList.toggle("exhausted", counts[n] >= 9);
  });
  // (querySelectorAll is already safe when the pad is absent)
}

// --- Interaction -----------------------------------------------------------
function selectCell(row, col) {
  selected = { row, col };
  renderGrid();
  cellEls[row][col].focus();
}

function moveSelection(dRow, dCol) {
  const row = Math.min(N - 1, Math.max(0, selected.row + dRow));
  const col = Math.min(N - 1, Math.max(0, selected.col + dCol));
  selectCell(row, col);
}

function enterNumber(num) {
  if (solved) return;
  const { row, col } = selected;
  if (givenGrid[row][col] !== 0) return; // can't edit a clue

  if (noteMode) {
    if (currentGrid[row][col] !== 0) return; // notes only on empty cells
    const cellNotes = notes[row][col];
    if (cellNotes.has(num)) cellNotes.delete(num);
    else cellNotes.add(num);
  } else {
    // Pressing the number already in the cell clears it
    currentGrid[row][col] = currentGrid[row][col] === num ? 0 : num;
    notes[row][col].clear();
    if (currentGrid[row][col] !== 0) clearNotesForPeers(row, col, num);
  }

  renderGrid();
  checkWin();
}

// Placing a number rubs it out of the pencil marks it invalidates
function clearNotesForPeers(row, col, num) {
  for (let i = 0; i < N; i++) {
    notes[row][i].delete(num);
    notes[i][col].delete(num);
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      notes[startRow + i][startCol + j].delete(num);
    }
  }
}

function eraseCell() {
  if (solved) return;
  const { row, col } = selected;
  if (givenGrid[row][col] !== 0) return;
  currentGrid[row][col] = 0;
  notes[row][col].clear();
  renderGrid();
}

function toggleNoteMode() {
  noteMode = !noteMode;
  const btn = el("note-btn");
  if (btn) {
    btn.classList.toggle("active", noteMode);
    btn.setAttribute("aria-pressed", String(noteMode));
  }
  setText("note-state", noteMode ? "On" : "Off");
}

// --- Win check -------------------------------------------------------------
function checkWin() {
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (currentGrid[row][col] === 0) return;
    }
  }
  // Full board — accept any arrangement that satisfies the rules, not just the
  // stored solution. (Generation guarantees uniqueness, so they're the same
  // grid, but validating the rules is the honest check.)
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (!isValid(currentGrid, row, col, currentGrid[row][col])) return;
    }
  }

  solved = true;
  stopTimer();

  const completionMsg = document.getElementById("completion-message");
  completionMsg.innerHTML =
    "🎉 Congratulations! You solved the puzzle! 🎉" +
    `<br><small>Time: ${formatTime(elapsedSeconds)} &middot; ${
      hintsUsed === 0 ? "no hints" : `${hintsUsed} hint${hintsUsed === 1 ? "" : "s"}`
    }</small>`;
  completionMsg.style.display = "block";

  cellEls.flat().forEach((cell, index) => {
    setTimeout(() => cell.classList.add("celebrate"), index * 8);
  });

  // Hinted solves don't earn a best time
  if (hintsUsed === 0) {
    const bestKey = `sudoku-best-${currentDifficulty}`;
    const currentBest = parseInt(localStorage.getItem(bestKey) || "0", 10);
    if (!currentBest || elapsedSeconds < currentBest) {
      localStorage.setItem(bestKey, String(elapsedSeconds));
      completionMsg.innerHTML += "<br><small>🏆 New Best Time!</small>";
      updateBestTime();
    }
  }
}

function updateBestTime() {
  const bestKey = `sudoku-best-${currentDifficulty}`;
  const best = parseInt(localStorage.getItem(bestKey) || "0", 10);
  setText("best-time", best ? formatTime(best) : "--:--");
}

// --- Hints -----------------------------------------------------------------
function getHint() {
  if (solved) return;
  const empties = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      if (currentGrid[row][col] !== solution[row][col]) empties.push({ row, col });
    }
  }
  if (empties.length === 0) return;

  const pick = empties[Math.floor(Math.random() * empties.length)];
  currentGrid[pick.row][pick.col] = solution[pick.row][pick.col];
  notes[pick.row][pick.col].clear();
  clearNotesForPeers(pick.row, pick.col, solution[pick.row][pick.col]);
  cellEls[pick.row][pick.col].classList.add("hint");
  hintsUsed++;
  setText("hint-count", hintsUsed);
  selected = { row: pick.row, col: pick.col };

  renderGrid();
  checkWin();
}

// --- Timer -----------------------------------------------------------------
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  startTime = Date.now();
  elapsedSeconds = 0;
  document.getElementById("timer").textContent = "00:00";
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("timer").textContent = formatTime(elapsedSeconds);
  }, 250);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- New game --------------------------------------------------------------
function newGame() {
  const difficulty = document.getElementById("difficulty").value;
  currentDifficulty = difficulty;
  document.getElementById("current-difficulty").textContent =
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  const status = document.getElementById("completion-message");
  status.style.display = "none";
  status.innerHTML = "🎉 Congratulations! You solved the puzzle! 🎉";

  const board = document.getElementById("sudoku-grid");
  board.classList.add("generating");
  document.getElementById("timer").textContent = "--:--";
  stopTimer();

  requestPuzzle(difficulty, ({ puzzle, solution: generated }) => {
    currentGrid = cloneGrid(puzzle);
    givenGrid = cloneGrid(puzzle);
    solution = generated;
    notes = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => new Set())
    );
    selected = { row: 0, col: 0 };
    solved = false;
    hintsUsed = 0;
    noteMode = false;

    setText("hint-count", "0");
    const noteBtn = el("note-btn");
    if (noteBtn) {
      noteBtn.classList.remove("active");
      noteBtn.setAttribute("aria-pressed", "false");
    }
    setText("note-state", "Off");

    cellEls.flat().forEach((cell) => {
      cell.classList.remove("celebrate", "hint");
    });

    board.classList.remove("generating");
    renderGrid();
    updateBestTime();
    startTimer();
  });
}

// --- Input wiring ----------------------------------------------------------
function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "select" || tag === "input" || tag === "textarea") return;

    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      enterNumber(Number(e.key));
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveSelection(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveSelection(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveSelection(0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveSelection(0, 1);
        break;
      case "Backspace":
      case "Delete":
      case "0":
        e.preventDefault();
        eraseCell();
        break;
      case "n":
      case "N":
        e.preventDefault();
        toggleNoteMode();
        break;
      case "h":
      case "H":
        e.preventDefault();
        getHint();
        break;
      default:
        break;
    }
  });
}

function setupNumberPad() {
  document.querySelectorAll(".num-btn[data-number]").forEach((btn) => {
    btn.addEventListener("click", () => enterNumber(Number(btn.dataset.number)));
  });
  const eraseBtn = el("erase-btn");
  if (eraseBtn) eraseBtn.addEventListener("click", eraseCell);
  const noteBtn = el("note-btn");
  if (noteBtn) noteBtn.addEventListener("click", toggleNoteMode);
}

// Initialize game
document.addEventListener("DOMContentLoaded", function () {
  buildGrid();
  setupKeyboard();
  setupNumberPad();
  const difficultySelect = el("difficulty");
  if (difficultySelect) difficultySelect.addEventListener("change", newGame);
  newGame();
});
