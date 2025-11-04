const express = require("express");
const fileUpload = require("express-fileupload");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const fs = require("fs");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());
app.use(express.static("public"));

/*************** SQLITE DB INIT ***************/
const db = new sqlite3.Database("./jobs.db", (err) => {
  if (err) console.log("❌ DB Error:", err);
  else console.log("✅ SQLite DB ready");
});

// ✅ Auto create tables if not exist
db.run(
  `CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT,
      email TEXT UNIQUE,
      password TEXT
  )`
);

db.run(
  `CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password TEXT,
      resume_path TEXT,
      resume_text TEXT
  )`
);

/**************** Employer Signup/Login ****************/
app.post("/employer/signup", async (req, res) => {
  const { company_name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO employers (company_name, email, password) VALUES (?, ?, ?)`,
    [company_name, email, hashedPassword],
    (err) => {
      if (err) return res.send("❌ Email already exists.");
      res.redirect("/employer-login.html");
    }
  );
});

app.post("/employer/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM employers WHERE email = ?`, [email], async (err, user) => {
    if (!user) return res.send("❌ Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("❌ Invalid credentials");

    res.redirect("/employer-dashboard.html");
  });
});

/**************** Candidate Signup/Login ****************/
app.post("/candidate/signup", async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO candidates (full_name, email, phone, password) VALUES (?, ?, ?, ?)`,
    [full_name, email, phone, hashedPassword],
    (err) => {
      if (err) return res.send("❌ Email already exists.");
      res.redirect("/candidate-login.html");
    }
  );
});

app.post("/candidate/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM candidates WHERE email = ?`, [email], async (err, user) => {
    if (!user) return res.send("❌ Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send("❌ Invalid credentials");

    res.redirect("/candidate-dashboard.html");
  });
});

/**************** Resume Upload + Text Extraction ****************/
app.post("/upload-resume", (req, res) => {
  if (!req.files || !req.files.resume) return res.send("❌ No file uploaded");

  const resume = req.files.resume;
  const savePath = "./public/resumes/" + resume.name;

  resume.mv(savePath, async (err) => {
    if (err) return res.send("❌ Upload failed");

    let extractedText = "";

    if (resume.name.endsWith(".pdf")) {
      const buffer = fs.readFileSync(savePath);
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (resume.name.endsWith(".docx")) {
      const data = await mammoth.extractRawText({ path: savePath });
      extractedText = data.value;
    }

    db.run(
      `UPDATE candidates SET resume_path = ?, resume_text = ? WHERE email = ?`,
      ["/resumes/" + resume.name, extractedText, req.body.email]
    );

    res.send("✅ Resume uploaded & scanned!");
  });
});

/**************** Resume Matching ****************/
app.post("/match-resumes", (req, res) => {
  const { job_description } = req.body;

  db.all(`SELECT * FROM candidates`, (err, rows) => {
    let results = rows.map((c) => {
      let score = 0;
      job_description.toLowerCase().split(" ").forEach((word) => {
        if (c.resume_text && c.resume_text.toLowerCase().includes(word)) score++;
      });
      return { full_name: c.full_name, resume_path: c.resume_path, score };
    });

    results.sort((a, b) => b.score - a.score);
    res.json(results);
  });
});

/**************** Start Server ****************/
app.listen(10000, () => console.log("🚀 Server running at http://localhost:10000"));