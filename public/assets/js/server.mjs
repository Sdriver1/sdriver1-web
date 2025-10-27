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
  GAMES: 8087,
  BLOGS: 8088,
};

const PATHS = {
  ASSETS: join(__dirname, "../../../public/assets"),
  PUBLIC: join(__dirname, "../../../public"),
  VISITOR_COUNT: join(
    __dirname,
    "../../../public/assets/data/visitorCount.json"
  ),
  CLICK_COUNT: join(__dirname, "../../../public/assets/data/clickCount.json"),
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

const sessionTokens = new Map();
function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of sessionTokens.entries()) {
    if (now - data.created > 3600000) {
      sessionTokens.delete(token);
    }
  }
}, 300000);

const userAgentCheckMiddleware = (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const validAgents = process.env.VALID_USER_AGENTS?.split(",");
  const isValidBrowser = validAgents.some((agent) => userAgent.includes(agent));

  if (!isValidBrowser) {
    console.log(
      `[SECURITY] Blocked request - Invalid user-agent: ${userAgent} from IP: ${req.ip}`
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid client",
    });
  }

  next();
};

const referrerCheckMiddleware = (req, res, next) => {
  const referrer = req.headers.referer || req.headers.referrer;

  if (
    !referrer ||
    (!referrer.includes("youarenow.gay") && !referrer.includes("localhost"))
  ) {
    console.log(
      `[SECURITY] Blocked request - Invalid referrer: ${referrer} from IP: ${req.ip}`
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid request origin",
    });
  }

  next();
};

const antiBotMiddleware = (req, res, next) => {
  const token = req.headers["x-session-token"];

  if (!token || !sessionTokens.has(token)) {
    console.log(
      `[SECURITY] Blocked request - Invalid/missing session token from IP: ${req.ip}`
    );
    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid or missing session token",
    });
  }

  const clientIp =
    req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];
  const cleanIp = clientIp.replace(/^::ffff:/, "");

  console.log(`[SECURITY] Valid request from IP: ${cleanIp}`);

  next();
};

const corsMiddleware = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Session-Token"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
};
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 20) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const ip =
        req.ip ||
        req.connection.remoteAddress ||
        req.headers["x-forwarded-for"];
      const cleanIp = ip.replace(/^::ffff:/, "");
      const now = Date.now();

      for (const [key, data] of this.requests.entries()) {
        if (now - data.resetTime > this.windowMs) {
          this.requests.delete(key);
        }
      }

      const userRequests = this.requests.get(cleanIp) || {
        count: 0,
        resetTime: now,
      };

      if (now - userRequests.resetTime > this.windowMs) {
        userRequests.count = 0;
        userRequests.resetTime = now;
      }

      userRequests.count++;
      this.requests.set(cleanIp, userRequests);

      res.setHeader("X-RateLimit-Limit", this.maxRequests);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, this.maxRequests - userRequests.count)
      );
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(userRequests.resetTime + this.windowMs).toISOString()
      );

      if (userRequests.count > this.maxRequests) {
        console.log(
          `[RATE LIMIT] Blocked IP ${cleanIp} - ${userRequests.count}/${this.maxRequests} requests`
        );
        return res.status(429).json({
          error: "Too many requests",
          message: "Please slow down and try again later",
          retryAfter: Math.ceil(
            (userRequests.resetTime + this.windowMs - now) / 1000
          ),
        });
      }

      next();
    };
  }
}

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${
        res.statusCode
      } (${duration}ms)`
    );
  });
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.stack}`);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
};

// ======================== DATA MANAGEMENT ========================
class CounterManager {
  constructor(filePath, initialValue = 0) {
    this.filePath = filePath;
    this.count = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath)).count
      : initialValue;
    this.saveTimeout = null;
    this.isDirty = false;
  }

  get() {
    return this.count;
  }

  increment() {
    this.count++;
    this.isDirty = true;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000);

    return this.count;
  }

  save() {
    if (!this.isDirty) return;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify({ count: this.count }));
      this.isDirty = false;
    } catch (error) {
      console.error(`Failed to save counter to ${this.filePath}:`, error);
    }
  }
}

const visitorCounter = new CounterManager(PATHS.VISITOR_COUNT);
const clickCounter = new CounterManager(PATHS.CLICK_COUNT);

process.on("SIGTERM", () => {
  visitorCounter.save();
  clickCounter.save();
  process.exit(0);
});

process.on("SIGINT", () => {
  visitorCounter.save();
  clickCounter.save();
  process.exit(0);
});

// ======================== SERVER 1: MAIN SITE (sdriver1.me / stevendriver.com) ========================
function createMainServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  const pageCache = (req, res, next) => {
    res.set("Cache-Control", "public, max-age=3600");
    next();
  };
  app.get("/", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "sites/index.html"))
  );
  app.get("/github", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "redirects/github.html"))
  );
  app.get("/linkedin", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "redirects/linkedin.html"))
  );
  app.get("/kofi", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "redirects/kofi.html"))
  );
  app.get("/calculator", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "calculator/index.html"))
  );
  app.get("/resume", (req, res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(join(PATHS.ASSETS, "resume/resume.pdf"));
  });
  app.get("/resumepng", (req, res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(join(PATHS.ASSETS, "resume/resume.png"));
  });
  app.get("/change", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "sites/changehelp.html"))
  );

  app.use(errorHandler);
  app.listen(PORTS.MAIN, () =>
    console.log(`Main server running on port ${PORTS.MAIN}`)
  );
}

// ======================== SERVER 2: RIT PORTFOLIO (rit.sdriver1.me) ========================
function createRitServer() {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  app.get("/", (req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.sendFile(join(PATHS.PUBLIC, "rit/index.html"));
  });

  app.use(errorHandler);
  app.listen(PORTS.RIT, () =>
    console.log(`RIT server running on port ${PORTS.RIT}`)
  );
}

// ======================== SERVER 3: IMAGE CDN (images.sdriver1.me) ========================
function createImageServer() {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  app.get("/:imageName", (req, res) => {
    const imageName = req.params.imageName;

    if (
      imageName.includes("..") ||
      imageName.includes("/") ||
      imageName.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid image name" });
    }

    const imagePath = join(PATHS.ASSETS, "images", imageName);

    console.log(`Requested image: ${imageName}`);
    console.log(`Looking for image at: ${imagePath}`);

    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`Image not found: ${imagePath}`);
        res.status(404).json({
          error: "Image not found",
          message: `The image "${imageName}" does not exist`,
        });
      } else {
        res.set("Cache-Control", "public, max-age=86400");
        res.sendFile(imagePath);
      }
    });
  });

  app.use(errorHandler);
  app.listen(PORTS.IMAGES, () =>
    console.log(`Image server running on port ${PORTS.IMAGES}`)
  );
}

// ======================== SERVER 4: GAY SITE (youarenow.gay) ========================
function createGayServer() {
  const app = express();
  app.use(express.json());

  app.use(corsMiddleware);
  app.use(requestLogger);

  const apiLimiter = new RateLimiter(60000, 20);
  const postLimiter = new RateLimiter(60000, 1);

  app.use("/assets", createStaticMiddleware());
  app.use(
    "/assets/videos",
    express.static(join(PATHS.ASSETS, "videos"), {
      cacheControl: true,
      maxAge: "1d",
      immutable: true,
      setHeaders: (res, path) => {
        res.setHeader("Accept-Ranges", "bytes");
      },
    })
  );

  app.get(
    "/api/token",
    userAgentCheckMiddleware,
    referrerCheckMiddleware,
    apiLimiter.middleware(),
    (req, res) => {
      const token = generateSessionToken();
      sessionTokens.set(token, {
        created: Date.now(),
        ip: req.ip,
      });
      res.json({ token });
    }
  );

  app.get(
    "/api/clicks",
    userAgentCheckMiddleware,
    referrerCheckMiddleware,
    apiLimiter.middleware(),
    (req, res, next) => {
      try {
        const clicks = clickCounter.get();
        res.set("Cache-Control", "public, max-age=5");
        res.json({
          clicks,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/api/addclicks",
    userAgentCheckMiddleware,
    referrerCheckMiddleware,
    postLimiter.middleware(),
    antiBotMiddleware,
    (req, res, next) => {
      try {
        const clicks = clickCounter.increment();
        res.set("Cache-Control", "no-store");
        res.json({
          clicks,
          message: "Click recorded successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/visits",
    userAgentCheckMiddleware,
    referrerCheckMiddleware,
    apiLimiter.middleware(),
    (req, res, next) => {
      try {
        const visits = visitorCounter.get();
        res.set("Cache-Control", "public, max-age=5");
        res.json({
          visits,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.post(
    "/api/addvisits",
    userAgentCheckMiddleware,
    referrerCheckMiddleware,
    postLimiter.middleware(),
    antiBotMiddleware,
    (req, res, next) => {
      try {
        const visits = visitorCounter.increment();
        res.set("Cache-Control", "no-store");
        res.json({
          visits,
          message: "Visit recorded successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      counters: {
        visits: visitorCounter.get(),
        clicks: clickCounter.get(),
      },
    });
  });

  app.get("/", (req, res) => {
    res.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.sendFile(join(PATHS.PUBLIC, "sites/gay.html"));
  });

  app.get("/ungay", (req, res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(join(PATHS.ASSETS, "videos/video.mp4"));
  });

  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: "The requested resource does not exist",
      path: req.path,
    });
  });

  app.use(errorHandler);

  app.listen(PORTS.GAY, () =>
    console.log(`Gay server running on port ${PORTS.GAY}`)
  );
}

// ======================== SERVER 5: NIGHTWING SITE (nightwing7974is.gay) ========================
function createNightwingServer() {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  app.get("/", (req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.sendFile(join(PATHS.PUBLIC, "sites/nightwing7974is.html"));
  });

  app.use(errorHandler);
  app.listen(PORTS.NIGHTWING, () =>
    console.log(`Nightwing server running on port ${PORTS.NIGHTWING}`)
  );
}

// ======================== SERVER 6: GAMES SITE (games.sdriver1.me) ========================
function createGamesServer() {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  const pageCache = (req, res, next) => {
    res.set("Cache-Control", "public, max-age=3600");
    next();
  };

  app.get("/", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "games/index.html"))
  );
  app.get("/minesweeper", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "games/minesweeper.html"))
  );
  app.get("/sudoku", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "games/sudoku.html"))
  );
  app.get("/2048", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "games/2048.html"))
  );
  app.get("/snake", pageCache, (req, res) =>
    res.sendFile(join(PATHS.PUBLIC, "games/snake.html"))
  );

  app.use(errorHandler);
  app.listen(PORTS.GAMES, () =>
    console.log(`Games server running on port ${PORTS.GAMES}`)
  );
}

// ======================== SERVER 7: BLOGS SITE (blogs.sdriver1.me) ========================
function createBlogsServer() {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/assets", createStaticMiddleware());

  app.get("/", (req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.sendFile(join(PATHS.PUBLIC, "blogs/index.html"));
  });

  app.get("/:name", (req, res) => {
    const name = req.params.name;

    // Validate name (prevent directory traversal)
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      return res.status(400).json({ error: "Invalid blog name" });
    }

    const blogPath = join(PATHS.PUBLIC, "blogs", `${name}.html`);

    if (fs.existsSync(blogPath)) {
      res.set("Cache-Control", "public, max-age=3600");
      res.sendFile(blogPath);
    } else {
      res.status(404).json({
        error: "Blog not found",
        message: `The blog "${name}" does not exist`,
      });
    }
  });

  app.use(errorHandler);
  app.listen(PORTS.BLOGS, () =>
    console.log(`Blogs server running on port ${PORTS.BLOGS}`)
  );
}

// ======================== START ALL SERVERS ========================
createMainServer();
createRitServer();
createImageServer();
createGayServer();
createNightwingServer();
createGamesServer();
createBlogsServer();
