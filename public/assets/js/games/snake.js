// Snake game implementation
class SnakeGame {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.intervalId = null;
    this.passThroughWalls = false;
    this.appleCount = 1;
    this.apples = [];
    this.state = "ready"; // ready, playing, paused, over
    // Queued turns, so two key presses inside one tick can't reverse the snake
    this.dirQueue = [];
    this.setDifficulty("easy");
    this.bindKeys();
    this.bindTouch();
  }

  setDifficulty(level) {
    const defs = {
      easy: { cols: 20, rows: 20, box: 20, speed: 120, label: "Slow" },
      medium: { cols: 25, rows: 20, box: 16, speed: 90, label: "Normal" },
      hard: { cols: 30, rows: 24, box: 14, speed: 65, label: "Fast" },
    };
    this.level = level;
    this.cfg = defs[level] || defs.medium;
    this.canvas.width = this.cfg.cols * this.cfg.box;
    this.canvas.height = this.cfg.rows * this.cfg.box;
    this.ui.speedLabel.textContent = this.cfg.label;
    this.updateBest();
    // Show an idle board instead of a blank canvas
    if (this.state !== "playing" && this.state !== "paused") {
      this.reset();
      this.draw();
      this.drawOverlay("Press New Game or any arrow key");
    }
  }

  bestKey() {
    return `snake-best-${this.level}`;
  }

  updateBest() {
    const best = localStorage.getItem(this.bestKey());
    // #best is new in this redesign; a cached page won't have it
    if (this.ui.best) this.ui.best.textContent = best ? best : "--";
  }

  saveBest() {
    const best = parseInt(localStorage.getItem(this.bestKey()) || "0", 10);
    if (this.score > best) {
      localStorage.setItem(this.bestKey(), String(this.score));
      this.updateBest();
      return true;
    }
    return false;
  }

  start() {
    // Read settings
    this.passThroughWalls = document.getElementById("passThroughWalls").checked;
    this.appleCount = Math.max(
      1,
      Math.min(5, parseInt(document.getElementById("appleCount").value, 10) || 1)
    );
    this.reset();
    this.state = "playing";
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.loop(), this.cfg.speed);
    this.ui.status.textContent = "Playing";
    this.ui.statusMessage.textContent = "";
    this.draw();
  }

  togglePause() {
    if (this.state === "playing") {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.state = "paused";
      this.ui.status.textContent = "Paused";
      this.drawOverlay("Paused — press Space to resume");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.ui.status.textContent = "Playing";
      this.intervalId = setInterval(() => this.loop(), this.cfg.speed);
      this.draw();
    }
  }

  reset() {
    const { cols, rows } = this.cfg;
    this.snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    this.dir = { x: 1, y: 0 };
    this.dirQueue = [];
    this.apples = [];
    for (let i = 0; i < this.appleCount; i++) {
      this.spawnFood();
    }
    this.score = 0;
    this.updateUI();
  }

  spawnFood() {
    const { cols, rows } = this.cfg;
    // Bail out if the snake fills the board — nowhere left to put an apple
    if (this.snake.length + this.apples.length >= cols * rows) return;
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (
      this.snake.some((s) => s.x === pos.x && s.y === pos.y) ||
      this.apples.some((a) => a.x === pos.x && a.y === pos.y)
    );
    this.apples.push(pos);
  }

  bindKeys() {
    const keyDirs = {
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowup: [0, -1],
      w: [0, -1],
      arrowright: [1, 0],
      d: [1, 0],
      arrowdown: [0, 1],
      s: [0, 1],
    };

    window.addEventListener("keydown", (e) => {
      // Never steal keys from the settings inputs
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      const key = e.key.toLowerCase();

      if (key === " " || key === "spacebar") {
        e.preventDefault();
        this.togglePause();
        return;
      }

      const dir = keyDirs[key];
      if (!dir) return;
      // Stop arrow keys from scrolling the page mid-game
      e.preventDefault();

      // Arrow key from an idle board starts a fresh run
      if (this.state === "ready" || this.state === "over") {
        this.start();
      }
      this.changeDir(dir[0], dir[1]);
    });
  }

  bindTouch() {
    let startX = null;
    let startY = null;

    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    this.canvas.addEventListener("touchend", (e) => {
      if (startX === null || startY === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      startY = null;

      // Ignore taps that were too small to be a deliberate swipe
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        this.togglePause();
        return;
      }

      if (this.state === "ready" || this.state === "over") this.start();

      if (Math.abs(dx) > Math.abs(dy)) {
        this.changeDir(dx > 0 ? 1 : -1, 0);
      } else {
        this.changeDir(0, dy > 0 ? 1 : -1);
      }
    });
  }

  changeDir(x, y) {
    // Compare against the last queued turn, not the direction currently on
    // screen — otherwise two turns inside one tick can double back on us.
    const last = this.dirQueue.length
      ? this.dirQueue[this.dirQueue.length - 1]
      : this.dir;
    if (last.x === -x && last.y === -y) return; // no reversing
    if (last.x === x && last.y === y) return; // no duplicates
    if (this.dirQueue.length < 2) this.dirQueue.push({ x, y });
  }

  loop() {
    if (this.dirQueue.length) this.dir = this.dirQueue.shift();

    let head = {
      x: this.snake[0].x + this.dir.x,
      y: this.snake[0].y + this.dir.y,
    };
    // Wall collision
    if (this.passThroughWalls) {
      if (head.x < 0) head.x = this.cfg.cols - 1;
      if (head.x >= this.cfg.cols) head.x = 0;
      if (head.y < 0) head.y = this.cfg.rows - 1;
      if (head.y >= this.cfg.rows) head.y = 0;
    } else {
      if (
        head.x < 0 ||
        head.x >= this.cfg.cols ||
        head.y < 0 ||
        head.y >= this.cfg.rows
      ) {
        this.gameOver();
        return;
      }
    }
    // Self collision — the tail square is fair game, it moves out of the way
    // this same tick unless we're about to grow into it.
    const willGrow = this.apples.some(
      (a) => a.x === head.x && a.y === head.y
    );
    const body = willGrow ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === head.x && s.y === head.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(head);
    // Eat food (support multiple apples)
    let ateApple = false;
    for (let i = 0; i < this.apples.length; i++) {
      if (head.x === this.apples[i].x && head.y === this.apples[i].y) {
        this.score += 1;
        this.apples.splice(i, 1);
        this.spawnFood();
        ateApple = true;
        break;
      }
    }
    if (!ateApple) {
      this.snake.pop();
    }

    this.draw();
    this.updateUI();
  }

  gameOver() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.state = "over";
    this.ui.status.textContent = "Game Over";
    const isBest = this.saveBest();
    this.ui.statusMessage.textContent = isBest
      ? `New best — ${this.score}! Press New Game to play again.`
      : `Game over — score ${this.score}. Press New Game to try again.`;
    this.drawOverlay(`Game Over — ${this.score}`);
  }

  updateUI() {
    this.ui.score.textContent = this.score;
  }

  cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  draw() {
    const ctx = this.ctx;
    const { box } = this.cfg;
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    // background
    ctx.fillStyle = this.cssVar("--bg-secondary", isDark ? "#1f2129" : "#eef0f4");
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // grid (subtle) — drawn as one path instead of a stroke per line
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.canvas.width; x += box) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.canvas.height; y += box) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.canvas.width, y + 0.5);
    }
    ctx.stroke();

    // apples — round, with a little stem highlight
    for (let i = 0; i < this.apples.length; i++) {
      const a = this.apples[i];
      const cx = a.x * box + box / 2;
      const cy = a.y * box + box / 2;
      ctx.fillStyle = "#e53935";
      ctx.beginPath();
      ctx.arc(cx, cy, box / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(cx - box * 0.12, cy - box * 0.12, box * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // snake — head brighter, body fading slightly toward the tail
    const r = Math.max(2, box * 0.25);
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const s = this.snake[i];
      if (i === 0) {
        ctx.fillStyle = "#43a047";
      } else {
        const t = i / Math.max(1, this.snake.length);
        const light = isDark ? 45 - t * 12 : 32 - t * 8;
        ctx.fillStyle = `hsl(122, 32%, ${light}%)`;
      }
      this.roundRect(
        ctx,
        s.x * box + 1,
        s.y * box + 1,
        box - 2,
        box - 2,
        r
      );
      ctx.fill();
    }

    // eyes on the head, facing the direction of travel
    if (this.snake.length) {
      const h = this.snake[0];
      const cx = h.x * box + box / 2;
      const cy = h.y * box + box / 2;
      const off = box * 0.18;
      const px = this.dir.y !== 0 ? off : 0;
      const py = this.dir.x !== 0 ? off : 0;
      const fx = this.dir.x * box * 0.12;
      const fy = this.dir.y * box * 0.12;
      ctx.fillStyle = "#ffffff";
      [
        [cx + px + fx, cy + py + fy],
        [cx - px + fx, cy - py + fy],
      ].forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(1.2, box * 0.09), 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  drawOverlay(text) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 16px Poppins, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
  }
}

// Wire up UI
const canvas = document.getElementById("snakeCanvas");
const ui = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  speedLabel: document.getElementById("speedLabel"),
  status: document.getElementById("status"),
  statusMessage: document.getElementById("status-message"),
};

const game = new SnakeGame(canvas, ui);

// Controls
document.getElementById("difficulty").addEventListener("change", (e) => {
  game.setDifficulty(e.target.value);
});

document.getElementById("newGameBtn").addEventListener("click", () => {
  game.setDifficulty(document.getElementById("difficulty").value);
  game.start();
});

const pauseBtn = document.getElementById("pauseBtn");
if (pauseBtn) {
  pauseBtn.addEventListener("click", () => game.togglePause());
}

// Settings dropdown logic
const settingsBtn = document.getElementById("settingsBtn");
const settingsDropdown = document.getElementById("settingsDropdown");

function closeSettingsDropdown() {
  settingsDropdown.style.display = "none";
  settingsBtn.setAttribute("aria-expanded", "false");
}

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = settingsDropdown.style.display !== "none";
  if (open) {
    closeSettingsDropdown();
  } else {
    settingsDropdown.style.display = "block";
    settingsBtn.setAttribute("aria-expanded", "true");
  }
});

document.addEventListener("click", (e) => {
  if (!settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
    closeSettingsDropdown();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettingsDropdown();
});

// Redraw when the theme flips so the board colors keep up
new MutationObserver(() => game.draw()).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

// Start with default difficulty shown
(function init() {
  const sel = document.getElementById("difficulty");
  game.setDifficulty(sel.value);
  ui.status.textContent = "Ready";
})();
