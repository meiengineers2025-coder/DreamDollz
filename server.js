import express from "express";
import session from "express-session";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- SQLite init (creates tables + demo users) ----
import "./sql/init-db-sqlite.js";

const app = express();

// -------- Helpers: resolve folders & files gracefully ----------
const exists = (p) => fs.existsSync(p);

const viewsDir =
  exists(path.join(__dirname, "views"))
    ? path.join(__dirname, "views")
    : path.join(__dirname, "src", "views");

const publicDir =
  exists(path.join(__dirname, "public"))
    ? path.join(__dirname, "public")
    : path.join(__dirname, "src", "public");

const routePath = (file) => {
  const rootPath = path.join(__dirname, "routes", file);
  if (exists(rootPath)) return `./routes/${file}`;
  const srcPath = path.join(__dirname, "src", "routes", file);
  if (exists(srcPath)) return `./src/routes/${file}`;
  throw new Error(`Route file not found: routes/${file} or src/routes/${file}`);
};

// -------- Views / static ----------
app.set("view engine", "ejs");
app.set("views", viewsDir);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(publicDir));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "changeme",
    resave: false,
    saveUninitialized: false,
  })
);

// -------- Dynamically import routes from whichever folder exists --------
const publicRoutes     = (await import(routePath("public.js"))).default;
const authRoutes       = (await import(routePath("auth.js"))).default;
const employerRoutes   = (await import(routePath("employers.js"))).default;
const candidateRoutes  = (await import(routePath("candidates.js"))).default;
const paymentRoutes    = (await import(routePath("payments.js"))).default;

app.use("/", publicRoutes);
app.use("/", authRoutes);
app.use("/", employerRoutes);
app.use("/", candidateRoutes);
app.use("/", paymentRoutes);

// Health + 404
app.get("/healthz", (_, res) => res.send("ok"));
app.use((req, res) => res.status(404).render("404", { user: req.session.user }));

// Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Views dir:", viewsDir);
  console.log("Public dir:", publicDir);
  console.log(`🚀 Server running on port ${port}`);
});