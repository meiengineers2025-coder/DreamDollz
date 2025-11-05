import "../src/config/db.js"; // ensures DB is created
import { db } from "../src/config/db.js";

// Enable foreign key support
db.exec(`PRAGMA foreign_keys = ON;`);

// DB Schema (tables)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('candidate','employer')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  education TEXT,
  experience_years INTEGER DEFAULT 0,
  skills TEXT,
  comments TEXT,
  resume_file TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  education TEXT,
  experience_years INTEGER DEFAULT 0,
  salary_min INTEGER DEFAULT 0,
  salary_max INTEGER DEFAULT 0,
  skills TEXT,
  comments TEXT,
  state TEXT,
  city TEXT,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  provider TEXT DEFAULT 'razorpay',
  order_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  status TEXT DEFAULT 'created',
  amount_paise INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

console.log("✅ SQLite tables created / already exist");

// Insert DEMO login users (password = 123456)
const demoPassHash = "$2a$10$V6G5hS0U9kV1v3yF9XcV1e7iE3b8g1b1lZfiqgqQYc8b1zY0d3U8u";

db.prepare(
  "INSERT OR IGNORE INTO users (id,email,password_hash,role) VALUES (1,'employer@example.com',?, 'employer')"
).run(demoPassHash);

db.prepare(
  "INSERT OR IGNORE INTO users (id,email,password_hash,role) VALUES (2,'candidate@example.com',?, 'candidate')"
).run(demoPassHash);


console.log("✅ Demo users inserted: employer@example.com / candidate@example.com (pass: 123456)");
