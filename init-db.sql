-- Database setup for Jobs Portal

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  skills TEXT,
  experience TEXT,
  resume_filename TEXT,
  resume_original TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
