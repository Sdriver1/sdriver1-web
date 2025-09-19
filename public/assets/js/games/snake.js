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
    this.setDifficulty("easy");
    this.bindKeys();
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
  }

  start() {
    // Read settings
    this.passThroughWalls = document.getElementById("passThroughWalls").checked;
    this.appleCount = Math.max(1, Math.min(5, parseInt(document.getElementById("appleCount").value) || 1));
    this.reset();
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.loop(), this.cfg.speed);
    this.ui.status.textContent = "Playing";
  }

  reset() {
    const { cols, rows } = this.cfg;
    this.snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    this.dir = { x: 1, y: 0 };
    this.apples = [];
    for (let i = 0; i < this.appleCount; i++) {
      this.spawnFood();
    }
    this.score = 0;
    this.updateUI();
  }

  spawnFood() {
    const { cols, rows } = this.cfg;
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
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") this.changeDir(-1, 0);
      if (key === "arrowup" || key === "w") this.changeDir(0, -1);
      if (key === "arrowright" || key === "d") this.changeDir(1, 0);
      if (key === "arrowdown" || key === "s") this.changeDir(0, 1);
    });
  }

  changeDir(x, y) {
    // Prevent reversing
    if (this.dir.x === -x && this.dir.y === -y) return;
    this.dir = { x, y };
  }

  loop() {
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
    // Self collision
    if (this.snake.some((s) => s.x === head.x && s.y === head.y)) {
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
    this.ui.status.textContent = "Game Over";
    this.ui.statusMessage.textContent = `Game over — score ${this.score}. Press New Game to try again.`;
  }

  updateUI() {
    this.ui.score.textContent = this.score;
  }

  draw() {
    const ctx = this.ctx;
    const { box } = this.cfg;
    // background
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim() || "#fff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // grid (subtle)
    ctx.strokeStyle = "rgba(0,0,0,0.03)";
    for (let x = 0; x <= this.canvas.width; x += box) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.canvas.height; y += box) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    // apples (multiple)
    for (let i = 0; i < this.apples.length; i++) {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(
        this.apples[i].x * box + 2,
        this.apples[i].y * box + 2,
        box - 4,
        box - 4
      );
    }

    // snake
    for (let i = 0; i < this.snake.length; i++) {
      const s = this.snake[i];
      ctx.fillStyle = i === 0 ? "#43a047" : "#1e293b";
      ctx.fillRect(s.x * box + 1, s.y * box + 1, box - 2, box - 2);
    }
  }
}

// Wire up UI
const canvas = document.getElementById("snakeCanvas");
const ui = {
  score: document.getElementById("score"),
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
  ui.statusMessage.textContent = "";
});

// Settings dropdown logic
const settingsBtn = document.getElementById("settingsBtn");
const settingsDropdown = document.getElementById("settingsDropdown");
const closeSettings = document.getElementById("closeSettings");

settingsBtn.addEventListener("click", () => {
  settingsDropdown.style.display = settingsDropdown.style.display === "none" ? "block" : "none";
});
closeSettings.addEventListener("click", () => {
  settingsDropdown.style.display = "none";
});
document.addEventListener("click", (e) => {
  if (!settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
    settingsDropdown.style.display = "none";
  }
});

// Start with default difficulty shown
(function init() {
  const sel = document.getElementById("difficulty");
  game.setDifficulty(sel.value);
  ui.status.textContent = "Ready";
})();
