import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Resolve DB path correctly even if project is nested
const projectRoot = path.resolve(__dirname, "..", "..");

// ✅ Use /data ONLY if it exists (Render persistent disk)
let dbDir = "/data";
if (!fs.existsSync(dbDir)) {
  dbDir = path.join(projectRoot, "data");   // Local fallback (GitHub / localhost)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, "portal.db");

console.log("📁 SQLite DB Path:", dbPath);

// ✅ Open SQLite database (creates if missing)
export const db = new Database(dbPath);

// Improve performance / avoid locking
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");