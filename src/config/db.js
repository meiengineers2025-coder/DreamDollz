import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT:
// On Render, SQLite will be stored on the PERSISTENT DISK (mount path: /data)
const dbPath = path.join("/data", "portal.db"); // <- lives on disk

console.log("📁 SQLite DB path =>", dbPath);

// Open database (file auto-creates if missing)
export const db = new Database(dbPath);

// WAL mode = prevents database lock and improves concurrency
db.pragma("journal_mode = WAL");

db.pragma("foreign_keys = ON");
