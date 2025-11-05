import express from "express";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run DB init
import "./sql/init-db-sqlite.js";

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "changeme",
    resave: false,
    saveUninitialized: false
  })
);
app.use(express.static(path.join(__dirname, "public")));

import publicRoutes from "./src/routes/public.js";
import authRoutes from "./src/routes/auth.js";
import employerRoutes from "./src/routes/employers.js";
import candidateRoutes from "./src/routes/candidates.js";
import paymentRoutes from "./src/routes/payments.js";

app.use("/", publicRoutes);
app.use("/", authRoutes);
app.use("/", employerRoutes);
app.use("/", candidateRoutes);
app.use("/", paymentRoutes);

app.use((req, res) => res.status(404).render("404", { user: req.session.user }));

app.get("/healthz", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on :${port}`));