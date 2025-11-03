// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'jobs.db');
const INIT_SQL = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer config: store in uploads with safe filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // prepend timestamp to prevent collisions
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Initialize DB
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Failed to open DB', err);
    process.exit(1);
  }
  db.exec(INIT_SQL, (err2) => {
    if (err2) console.error('Failed to init DB', err2);
    else console.log('DB initialized');
  });
});

// ---------- JOBS API (same basic CRUD) ----------
app.get('/api/jobs', (req, res) => {
  const q = (req.query.q || '').trim();
  const loc = (req.query.location || '').trim();
  const params = [];
  let sql = 'SELECT id, title, company, location, type, description, created_at FROM jobs';
  const filters = [];
  if (q) {
    filters.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (loc) {
    filters.push('location LIKE ?');
    params.push(`%${loc}%`);
  }
  if (filters.length) sql += ' WHERE ' + filters.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error', details: err.message });
    res.json(rows);
  });
});

app.post('/api/jobs', (req, res) => {
  const { title, company, location, type, description } = req.body;
  if (!title || !company) return res.status(400).json({ error: 'title and company required' });
  const sql = `INSERT INTO jobs (title, company, location, type, description) VALUES (?,?,?,?,?)`;
  db.run(sql, [title, company, location || '', type || '', description || ''], function(err) {
    if (err) return res.status(500).json({ error: 'DB error', details: err.message });
    db.get('SELECT * FROM jobs WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      res.status(201).json(row);
    });
  });
});

// ---------- JOB APPLICATIONS ----------
app.post('/api/jobs/:id/apply', (req, res) => {
  const job_id = req.params.id;
  const { name, email, cover_letter } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  db.get('SELECT id FROM jobs WHERE id = ?', [job_id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Job not found' });
    db.run('INSERT INTO applications (job_id, name, email, cover_letter) VALUES (?,?,?,?)',
      [job_id, name, email, cover_letter || ''], function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.status(201).json({ success: true, application_id: this.lastID });
      });
  });
});

// ---------- CANDIDATES API (resume upload & search) ----------
// POST candidate with resume file (multipart/form-data)
app.post('/api/candidates', upload.single('resume'), (req, res) => {
  const { name, email, phone, skills, experience } = req.body;
  if (!name || !email) {
    // delete uploaded file if present
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'name and email required' });
  }
  const resume_filename = req.file ? req.file.filename : null;
  const resume_original = req.file ? req.file.originalname : null;
  const resume_mime = req.file ? req.file.mimetype : null;

  const sql = `INSERT INTO candidates (name,email,phone,skills,experience,resume_filename,resume_original,resume_mime) VALUES (?,?,?,?,?,?,?,?)`;
  db.run(sql, [name,email,phone||'',skills||'',experience||'',resume_filename,resume_original,resume_mime], function(err) {
    if (err) {
      // cleanup file if saved
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'DB error', details: err.message });
    }
    db.get('SELECT * FROM candidates WHERE id = ?', [this.lastID], (er, row) => {
      if (er) return res.status(500).json({ error: 'DB error' });
      res.status(201).json(row);
    });
  });
});

// GET candidates with search (q matches name, skills, experience)
app.get('/api/candidates', (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = 'SELECT id, name, email, phone, skills, experience, resume_original, created_at FROM candidates';
  const params = [];
  if (q) {
    sql += ' WHERE name LIKE ? OR skills LIKE ? OR experience LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Download resume file
app.get('/api/candidates/:id/resume', (req, res) => {
  db.get('SELECT resume_filename, resume_original FROM candidates WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row || !row.resume_filename) return res.status(404).json({ error: 'No resume' });
    const filePath = path.join(UPLOAD_DIR, row.resume_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, row.resume_original || row.resume_filename);
  });
});

// ---------- CONTACT CANDIDATE (send email) ----------
// To use email sending, set these env vars:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT||587),
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
}

app.post('/api/contact', async (req, res) => {
  const { candidateId, subject, message, fromEmail } = req.body;
  if (!candidateId || !subject || !message || !fromEmail) return res.status(400).json({ error: 'candidateId, subject, message and fromEmail required' });

  db.get('SELECT email, name FROM candidates WHERE id = ?', [candidateId], async (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Candidate not found' });

    const transporter = getTransporter();
    if (!transporter) {
      // fallback: return candidate email so frontend can open user's email client
      return res.json({ success: false, reason: 'no-smtp-config', candidateEmail: row.email });
    }

    try {
      const info = await transporter.sendMail({
        from: process.env.FROM_EMAIL || fromEmail,
        to: row.email,
        subject,
        text: `Message from ${fromEmail}:\n\n${message}`,
        replyTo: fromEmail
      });
      res.json({ success: true, info });
    } catch (e) {
      console.error('Mail error', e);
      res.status(500).json({ error: 'Failed to send email', details: e.message });
    }
  });
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));