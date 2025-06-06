import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cors from "cors";
import nodemailer from "nodemailer";
import multer from "multer";

const upload = multer();

import {
  getDerivative,
  getIntegral,
  evaluateExpression,
} from "../../calculator/calculator.js";

// Load environment variables
dotenv.config();

// Helper to get the file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ======================== SERVER 1 (sdriver1.me / stevendriver.com - Port 8084) ========================
const app1 = express();
const port1 = 8084;
app1.use(express.json());
app1.use(express.urlencoded({ extended: true }));

app1.use("/assets", express.static(join(__dirname, "../../../public/assets")));

app1.get("/", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/sites/index.html"))
);
app1.get("/github", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/redirects/github.html"))
);
app1.get("/linkedin", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/redirects/linkedin.html"))
);
app1.get("/kofi", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/redirects/kofi.html"))
);

app1.get("/calculator", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/calculator/index.html"))
);

app1.get("/resume", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/assets/resume/resume.pdf"))
);
app1.get("/resumepng", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/assets/resume/resume.png"))
);
app1.get("/change", (req, res) =>
  res.sendFile(join(__dirname, "../../../public/sites/changehelp.html"))
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

app1.post(
  "/api/contact",
  upload.single("attachment"), // <-- multer middleware
  async (req, res) => {
    const { name, email, message } = req.body;

    try {
      await transporter.sendMail({
        from: `"${name}" <${email}>`,
        to: "sdriver@sdriver1.me",
        subject: `Portfolio message from ${name}`,
        text: `${message} \n\nFrom: ${name} <${email}>`,
      });
      res.sendStatus(200);
    } catch (err) {
      console.error("Mail error:", err);
      res.sendStatus(500);
    }
  }
);
app1.listen(port1, () =>
  console.log(`Server running on http://sdriver1.me:${port1}`)
);

// ======================== SERVER 3 (images.sdriver1.me - Port 8086) ========================
const app3 = express();
const port3 = 8086;

app3.use("/assets", express.static(join(__dirname, "../../../public/assets")));

app3.get("/:imageName", (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = join(__dirname, "../../../public/assets/images", imageName);

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

app3.listen(port3, () =>
  console.log(`Server running on http://images.sdriver1.me:${port3}`)
);

// ======================== SERVER 4 (youarenow.gay - Port 9090) ========================
const app4 = express();
const port4 = 9090;

const visitorCountFile = join(
  __dirname,
  "../../../public/assets/data/visitorCount.json"
);
const clickCountFile = join(
  __dirname,
  "../../../public/assets/data/clickCount.json"
);

// Initialize Click Count
let clickCount = fs.existsSync(clickCountFile)
  ? JSON.parse(fs.readFileSync(clickCountFile)).count
  : 0;

app4.use(express.json());

// ======================== Server 5 ( ========================

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token || token !== `Bearer ${process.env.PROFILE_API_TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// ======================== API Routes ========================
app4.get("/api/clicks", (req, res) => {
  res.json({ clicks: clickCount });
});

app4.post("/api/addclicks", (req, res) => {
  clickCount++;
  fs.writeFileSync(clickCountFile, JSON.stringify({ count: clickCount }));
  res.json({ clicks: clickCount });
});

let visitorCount = fs.existsSync(visitorCountFile)
  ? JSON.parse(fs.readFileSync(visitorCountFile)).count
  : 0;

app4.get("/api/visits", (req, res) => {
  res.json({ visits: visitorCount });
});

app4.post("/api/addvisits", (req, res) => {
  visitorCount++;
  fs.writeFileSync(visitorCountFile, JSON.stringify({ count: visitorCount }));
  res.json({ visits: visitorCount });
});

// Serve the main page
app4.use("/assets", express.static(join(__dirname, "../../../public/assets")));
app4.use(
  "/assets/videos",
  express.static(join(__dirname, "../../../public/assets/videos"), {
    cacheControl: true,
    maxAge: "1d",
  })
);

app4.get("/", (req, res) => {
  res.sendFile(join(__dirname, "../../../public/sites/gay.html"));
});
app4.get("/ungay", (req, res) => {
  res.sendFile(join(__dirname, "../../../public/assets/videos/video.mp4"));
});

app4.listen(port4, () =>
  console.log(`Server running on http://youarenow.gay:${port4}`)
);
