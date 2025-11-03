// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
const SECRET = process.env.SECRET || 'dreamjobs_secret';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox'; // 'sandbox' or 'live'

const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX allowed'));
  }
});

// Database
const db = new sqlite3.Database('jobs.db', (err) => {
  if (err) console.error('DB Error:', err.message);
  else console.log('Connected to jobs database.');
});

// Initialize DB
try {
  const initSql = fs.readFileSync(path.join(__dirname, 'init-db.sql'), 'utf8');
  db.exec(initSql, (err) => {
    if (err) console.log('DB init error:', err.message);
    else console.log('Database initialized.');
  });
} catch (err) {
  console.error('Could not read init-db.sql:', err.message);
}

// Helper: get PayPal access token
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) throw new Error('PayPal credentials missing (set PAYPAL_CLIENT_ID and PAYPAL_SECRET).');
  const tokenUrl = `${PAYPAL_BASE}/v1/oauth2/token`;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const res = await axios.post(tokenUrl, params, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return res.data.access_token;
}

// ====== AUTH HELPERS ======
function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const data = jwt.verify(token, SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ====== JOBS API ======
app.get('/api/jobs', (req, res) => {
  db.all('SELECT * FROM jobs', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/jobs', verifyToken, (req, res) => {
  // Only employers can post jobs; assume token for employer contains { employerId, role: 'employer' } OR name/id
  const { title, company, location, description } = req.body;
  // accept employer_id from token if present
  const employer_id = req.user && req.user.id ? req.user.id : null;
  db.run('INSERT INTO jobs (title, company, location, description, employer_id) VALUES (?, ?, ?, ?, ?)', [title, company, location, description, employer_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ====== Applications ======
app.post('/api/jobs/:id/apply', verifyToken, (req, res) => {
  // candidate must be logged in, token user id is candidate id
  const jobId = req.params.id;
  const candidateId = req.user && req.user.id;
  const { message } = req.body;
  if (!candidateId) return res.status(403).json({ error: 'Only candidates can apply' });
  db.run('INSERT INTO applications (job_id, candidate_id, message) VALUES (?, ?, ?)', [jobId, candidateId, message || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ====== CANDIDATE REGISTER (with resume upload) ======
app.post('/api/register', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const hashed = await bcrypt.hash(password, 10);
    const resumePath = req.file ? `/uploads/${req.file.filename}` : null;
    db.run('INSERT INTO candidates (name, email, password, resume) VALUES (?, ?, ?, ?)', [name, email, hashed, resumePath], function (err) {
      if (err) return res.status(400).json({ error: 'Email already exists' });
      const token = generateToken({ id: this.lastID, role: 'candidate', name });
      res.json({ message: 'Registered', token });
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CANDIDATE LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  // Check both candidates and employers for login; candidate login route uses this
  db.get('SELECT * FROM candidates WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Invalid email' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = generateToken({ id: user.id, role: 'candidate', name: user.name });
    res.json({ token, name: user.name, resume: user.resume });
  });
});

// ====== EMPLOYER REGISTER / LOGIN ======
app.post('/api/employer/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO employers (name, email, password) VALUES (?, ?, ?)', [name, email, hashed], function (err) {
    if (err) return res.status(400).json({ error: 'Email already exists' });
    const token = generateToken({ id: this.lastID, role: 'employer', name });
    res.json({ token, name });
  });
});

app.post('/api/employer/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM employers WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Invalid email' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = generateToken({ id: user.id, role: 'employer', name: user.name });
    res.json({ token, name: user.name });
  });
});

// ====== PAYPAL: Create Order (Employer) ======
app.post('/api/paypal/create-order', verifyToken, async (req, res) => {
  try {
    // only employers should create orders
    if (!req.user || req.user.role !== 'employer') return res.status(403).json({ error: 'Only employers allowed' });
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });

    const accessToken = await getPayPalAccessToken();
    const url = `${PAYPAL_BASE}/v2/checkout/orders`;
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: amount.toString()
          }
        }
      ],
      application_context: {
        brand_name: 'Dream Jobs Portal',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: '/', // after approval user will be redirected; client captures via orderID
        cancel_url: '/'
      }
    };

    const createRes = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const order = createRes.data;
    // find approve link
    const approve = (order.links || []).find(l => l.rel === 'approve');
    res.json({ orderID: order.id, approveUrl: approve ? approve.href : null });
  } catch (err) {
    console.error('Create order error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ====== PAYPAL: Capture Order ======
app.post('/api/paypal/capture-order', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'employer') return res.status(403).json({ error: 'Only employers allowed' });
    const { orderID } = req.body;
    if (!orderID) return res.status(400).json({ error: 'orderID required' });
    const accessToken = await getPayPalAccessToken();
    const url = `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`;

    const captureRes = await axios.post(url, {}, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    });

    // captureRes.data contains purchase_units[].payments.captures
    const captures = captureRes.data.purchase_units?.flatMap(u => (u.payments?.captures || [])) || [];
    const capture = captures[0] || null;
    const paypalCaptureId = capture ? capture.id : null;
    const amount = capture ? (capture.amount?.value || null) : null;

    // record payment in DB
    db.run('INSERT INTO payments (employer_id, amount, paypal_order_id, paypal_capture_id, note) VALUES (?, ?, ?, ?, ?)', [req.user.id, amount, orderID, paypalCaptureId, null], function (err) {
      if (err) console.error('Payment DB error:', err.message);
      res.json({ captured: true, orderID, paypalCaptureId, amount });
    });
  } catch (err) {
    console.error('Capture error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});

// ====== Employer: list applicants for their jobs (simple) ======
app.get('/api/employer/applicants', verifyToken, (req, res) => {
  if (!req.user || req.user.role !== 'employer') return res.status(403).json({ error: 'Only employers allowed' });
  const employerId = req.user.id;
  const sql = `
    SELECT a.*, j.title as job_title, c.name as candidate_name, c.email as candidate_email, c.resume as resume
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    JOIN candidates c ON c.id = a.candidate_id
    WHERE j.employer_id = ?
    ORDER BY a.applied_at DESC
  `;
  db.all(sql, [employerId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ====== Payments listing for employer ======
app.get('/api/employer/payments', verifyToken, (req, res) => {
  if (!req.user || req.user.role !== 'employer') return res.status(403).json({ error: 'Only employers allowed' });
  db.all('SELECT * FROM payments WHERE employer_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Default route serves index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));