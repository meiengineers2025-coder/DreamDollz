// server.js - simplified version for Render
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'jobs.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Create upload folder if not exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT, skills TEXT, experience TEXT,
    resume_filename TEXT, resume_original TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

// API: Add Candidate
app.post('/api/candidates', upload.single('resume'), (req, res) => {
  const { name, email, phone, skills, experience } = req.body;
  const file = req.file;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  db.run(`INSERT INTO candidates (name,email,phone,skills,experience,resume_filename,resume_original)
          VALUES (?,?,?,?,?,?,?)`,
    [name, email, phone || '', skills || '', experience || '',
     file ? file.filename : null, file ? file.originalname : null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

// API: Get Candidates
app.get('/api/candidates', (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : '%';
  db.all(`SELECT * FROM candidates WHERE name LIKE ? OR skills LIKE ? OR experience LIKE ? ORDER BY id DESC`,
    [q, q, q], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// Download Resume
app.get('/api/candidates/:id/resume', (req, res) => {
  db.get('SELECT resume_filename, resume_original FROM candidates WHERE id=?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOAD_DIR, row.resume_filename);
    res.download(filePath, row.resume_original);
  });
});

// Home page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
