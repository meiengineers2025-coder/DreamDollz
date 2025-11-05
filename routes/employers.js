import { Router } from "express";
import { db } from "../config/db.js";
import { requireAuth, requirePaid } from "../utils/access.js";

const r = Router();

// Employer Dashboard (post job + view jobs)
r.get("/employer/dashboard", requireAuth("employer"), (req, res) => {
  const jobs = db.prepare(
    "SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC"
  ).all(req.session.user.id);

  res.render("employer_dashboard", {
    user: req.session.user,
    myJobs: jobs
  });
});

// Create job
r.post("/employer/jobs", requireAuth("employer"), (req, res) => {
  const { title, education, experience_years, salary_min, salary_max, skills, comments, state, city, location } = req.body;

  db.prepare(
    `INSERT INTO jobs (employer_id, title, education, experience_years, salary_min, salary_max, skills, comments, state, city, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.session.user.id,
    title,
    education || "",
    Number(experience_years || 0),
    Number(salary_min || 0),
    Number(salary_max || 0),
    (skills || "").trim(),
    comments || "",
    state || "",
    city || "",
    location || ""
  );

  res.redirect("/employer/dashboard");
});

// Resume database (requires payment)
r.get("/employer/resumes", requirePaid("employer"), (req, res) => {
  const rows = db.prepare(
    `SELECT u.email, cp.* FROM candidate_profiles cp
     JOIN users u ON cp.user_id = u.id
     ORDER BY updated_at DESC`
  ).all();

  res.render("jobs_list", {
    user: req.session.user,
    items: rows,
    mode: "resumes"
  });
});

// Recommended candidates (requires payment)
r.get("/employer/recommended", requirePaid("employer"), (req, res) => {
  const job = db.prepare(
    "SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC LIMIT 1"
  ).get(req.session.user.id);

  const profiles = db.prepare("SELECT * FROM candidate_profiles").all();

  const jobSkills = (job?.skills || "")
    .toLowerCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const scored = profiles.map(p => {
    const userSkills = (p.skills || "")
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const overlap = userSkills.filter(s => jobSkills.includes(s)).length;
    const eduMatch = p.education?.toLowerCase() === job.education?.toLowerCase() ? 1 : 0;
    const expGap = Math.abs((p.experience_years || 0) - (job.experience_years || 0));
    const expScore = Math.max(0, 5 - expGap);

    return { ...p, score: eduMatch * 3 + overlap * 2 + expScore };
  }).sort((a, b) => b.score - a.score);

  res.render("recommended", {
    user: req.session.user,
    items: scored,
    job
  });
});

export default r;
