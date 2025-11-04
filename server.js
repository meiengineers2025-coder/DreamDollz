require("dotenv").config();
const express = require("express");
const fileUpload = require("express-fileupload");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload());
app.use(express.static("public"));

/*************** MySQL Connection ***************/
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ MySQL Connected.");
});

/**************** Employer Signup/Login ****************/
app.post("/employer/signup", async (req, res) => {
  const { company_name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO employers (company_name, email, password) VALUES (?, ?, ?)",
    [company_name, email, hashedPassword],
    (err) => {
      if (err) return res.send("❌ Email already exists.");
      res.redirect("/employer-login.html");
    }
  );
});

app.post("/employer/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM employers WHERE email = ?", [email],
    async (err, results) => {
      if (results.length === 0) return res.send("❌ Invalid credentials");

      const isMatch = await bcrypt.compare(password, results[0].password);
      if (!isMatch) return res.send("❌ Invalid credentials");

      res.redirect("/employer-dashboard.html");
    }
  );
});

/**************** Candidate Signup/Login ****************/
app.post("/candidate/signup", async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO candidates (full_name, email, phone, password) VALUES (?, ?, ?, ?)",
    [full_name, email, phone, hashedPassword],
    (err) => {
      if (err) return res.send("❌ Email already exists.");
      res.redirect("/candidate-login.html");
    }
  );
});

app.post("/candidate/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM candidates WHERE email = ?", [email],
    async (err, results) => {
      if (results.length === 0) return res.send("❌ Invalid credentials");

      const isMatch = await bcrypt.compare(password, results[0].password);
      if (!isMatch) return res.send("❌ Invalid credentials");

      res.redirect("/candidate-dashboard.html");
    }
  );
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

    db.query(
      "UPDATE candidates SET resume_path = ?, resume_text = ? WHERE email = ?",
      ["/resumes/" + resume.name, extractedText, req.body.email]
    );

    res.send("✅ Resume uploaded & scanned!");
  });
});

/**************** Resume Matching ****************/
app.post("/match-resumes", (req, res) => {
  const { job_description } = req.body;

  db.query(
    "SELECT full_name, email, resume_path, resume_text FROM candidates",
    (err, results) => {
      let matches = results.map((candidate) => {
        let score = 0;
        job_description.toLowerCase().split(" ").forEach(word => {
          if (candidate.resume_text && candidate.resume_text.toLowerCase().includes(word)) score++;
        });

        return { ...candidate, score };
      });

      matches.sort((a, b) => b.score - a.score);
      res.json(matches);
    }
  );
});

/**************** PayPal Payment ****************/
app.get("/pay", (req, res) => {
  res.redirect("https://www.paypal.com/paypalme/YOURPAYPALID");
});

/**************** Start Server ****************/
app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});