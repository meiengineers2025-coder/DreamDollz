import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Initialize database (creates SQLite + tables)
import "./sql/init-db-sqlite.js";

const app = express();

// ✅ Views folder (your repo has /views at root)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "changeme",
    resave: false,
    saveUninitialized: false,
  })
);

// ✅ Static assets (CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Routes (your repo has /routes at root, NOT inside /src)
import publicRoutes from "./routes/public.js";
import authRoutes from "./routes/auth.js";
import employerRoutes from "./routes/employers.js";
import candidateRoutes from "./routes/candidates.js";
import paymentRoutes from "./routes/payments.js";

app.use("/", publicRoutes);
app.use("/", authRoutes);
app.use("/", employerRoutes);
app.use("/", candidateRoutes);
app.use("/", paymentRoutes);

// ✅ 404 page
app.use((req, res) => {
  res.status(404).render("404", { user: req.session.user });
});

// ✅ Render health check
app.get("/healthz", (req, res) => res.send("ok"));

// ✅ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));