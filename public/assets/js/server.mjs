import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// ======================== CONFIGURATION ========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORTS = {
  MAIN: 8084,
  RIT: 8085,
  IMAGES: 8086,
  GAY: 9090,
  NIGHTWING: 6969,
  GAMES: 8087
};

const PATHS = {
  ASSETS: join(__dirname, "../../../public/assets"),
  PUBLIC: join(__dirname, "../../../public"),
  VISITOR_COUNT: join(__dirname, "../../../public/assets/data/visitorCount.json"),
  CLICK_COUNT: join(__dirname, "../../../public/assets/data/clickCount.json")
};

// ======================== SHARED MIDDLEWARE ========================
const createStaticMiddleware = () => express.static(PATHS.ASSETS);

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token || token !== `Bearer ${process.env.PROFILE_API_TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// ======================== DATA MANAGEMENT ========================
class CounterManager {
  constructor(filePath, initialValue = 0) {
    this.filePath = filePath;
    this.count = fs.existsSync(filePath) 
      ? JSON.parse(fs.readFileSync(filePath)).count 
      : initialValue;
  }

  get() {
    return this.count;
  }

  increment() {
    this.count++;
    fs.writeFileSync(this.filePath, JSON.stringify({ count: this.count }));
    return this.count;
  }
}

const visitorCounter = new CounterManager(PATHS.VISITOR_COUNT);
const clickCounter = new CounterManager(PATHS.CLICK_COUNT);

// ======================== SERVER 1: MAIN SITE (sdriver1.me / stevendriver.com) ========================
function createMainServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/assets", createStaticMiddleware());

  // Routes
  app.get("/", (req, res) => res.sendFile(join(PATHS.PUBLIC, "sites/index.html")));
  app.get("/github", (req, res) => res.sendFile(join(PATHS.PUBLIC, "redirects/github.html")));
  app.get("/linkedin", (req, res) => res.sendFile(join(PATHS.PUBLIC, "redirects/linkedin.html")));
  app.get("/kofi", (req, res) => res.sendFile(join(PATHS.PUBLIC, "redirects/kofi.html")));
  app.get("/calculator", (req, res) => res.sendFile(join(PATHS.PUBLIC, "calculator/index.html")));
  app.get("/resume", (req, res) => res.sendFile(join(PATHS.ASSETS, "resume/resume.pdf")));
  app.get("/resumepng", (req, res) => res.sendFile(join(PATHS.ASSETS, "resume/resume.png")));
  app.get("/change", (req, res) => res.sendFile(join(PATHS.PUBLIC, "sites/changehelp.html")));

  app.listen(PORTS.MAIN, () => console.log(`Main server running on port ${PORTS.MAIN}`));
}

// ======================== SERVER 2: RIT PORTFOLIO (rit.sdriver1.me) ========================
function createRitServer() {
  const app = express();
  app.use("/assets", createStaticMiddleware());
  
  app.get("/", (req, res) => res.sendFile(join(PATHS.PUBLIC, "rit/index.html")));

  app.listen(PORTS.RIT, () => console.log(`RIT server running on port ${PORTS.RIT}`));
}

// ======================== SERVER 3: IMAGE CDN (images.sdriver1.me) ========================
function createImageServer() {
  const app = express();
  app.use("/assets", createStaticMiddleware());

  app.get("/:imageName", (req, res) => {
    const imageName = req.params.imageName;
    const imagePath = join(PATHS.ASSETS, "images", imageName);

    console.log(`Requested image: ${imageName}`);
    console.log(`Looking for image at: ${imagePath}`);

    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`Image not found: ${imagePath}`);
        res.status(404).send("Image not found");
      } else {
        res.sendFile(imagePath);
      }
    });
  });

  app.listen(PORTS.IMAGES, () => console.log(`Image server running on port ${PORTS.IMAGES}`));
}

// ======================== SERVER 4: GAY SITE (youarenow.gay) ========================
function createGayServer() {
  const app = express();
  app.use(express.json());
  app.use("/assets", createStaticMiddleware());
  app.use("/assets/videos", express.static(join(PATHS.ASSETS, "videos"), {
    cacheControl: true,
    maxAge: "1d",
  }));

  // API Routes
  app.get("/api/clicks", (req, res) => res.json({ clicks: clickCounter.get() }));
  app.post("/api/addclicks", (req, res) => res.json({ clicks: clickCounter.increment() }));
  app.get("/api/visits", (req, res) => res.json({ visits: visitorCounter.get() }));
  app.post("/api/addvisits", (req, res) => res.json({ visits: visitorCounter.increment() }));

  // Page Routes
  app.get("/", (req, res) => res.sendFile(join(PATHS.PUBLIC, "sites/gay.html")));
  app.get("/ungay", (req, res) => res.sendFile(join(PATHS.ASSETS, "videos/video.mp4")));

  app.listen(PORTS.GAY, () => console.log(`Gay server running on port ${PORTS.GAY}`));
}

// ======================== SERVER 5: NIGHTWING SITE (nightwing7974is.gay) ========================
function createNightwingServer() {
  const app = express();
  app.use("/assets", createStaticMiddleware());
  
  app.get("/", (req, res) => res.sendFile(join(PATHS.PUBLIC, "sites/nightwing7974is.html")));

  app.listen(PORTS.NIGHTWING, () => console.log(`Nightwing server running on port ${PORTS.NIGHTWING}`));
}

// ======================== SERVER 6: GAMES SITE (games.sdriver1.me) ========================
function createGamesServer() {
  const app = express();
  app.use("/assets", createStaticMiddleware());

  app.get("/", (req, res) => res.sendFile(join(PATHS.PUBLIC, "games/index.html")));
  
  app.get("/minesweeper", (req, res) => res.sendFile(join(PATHS.PUBLIC, "games/minesweeper.html")));
  app.get("/sudoku", (req, res) => res.sendFile(join(PATHS.PUBLIC, "games/sudoku.html")));
  app.get("/2048", (req, res) => res.sendFile(join(PATHS.PUBLIC, "games/2048.html")));

  app.listen(PORTS.GAMES, () => console.log(`Games server running on port ${PORTS.GAMES}`));
}

// ======================== START ALL SERVERS ========================
createMainServer();
createRitServer();
createImageServer();
createGayServer();
createNightwingServer();
createGamesServer();
