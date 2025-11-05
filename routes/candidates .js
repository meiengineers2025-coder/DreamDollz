import { Router } from "express";
import { db } from "../config/db.js";
import { requireAuth, requirePaid } from "../utils/access.js";

const r = Router();

// Candidate Dashboard
r.get("/candidate/dashboard", requireAuth("candidate"), (req, res) => {
  const profile = db.prepare(
    "SELECT * FROM candidate_profiles WHERE user_id = ?"
  ).get(req.session.user.id);

  res.render("candidate_dashboard", {
    user: req.session.user,
    profile
  });
});

// Update candidate profile
r.post("/candidate/profile", requireAuth("candidate"), (req, res) => {
  const { education, experience_years, skills, comments } = req.body;

  db.prepare(`
    INSERT INTO candidate_profiles (user_id, education, experience_years, skills, comments)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET
      education = excluded.education,
      experience_years = excluded.experience_years,
      skills = excluded.skills,
      comments = excluded.comments,
      updated_at = CURRENT_TIMESTAMP;
  `).run(
    req.session.user.id,
    education || "",
    Number(experience_years || 0),
    skills || "",
    comments || ""
  );

  res.redirect("/candidate/dashboard");
});

// View all jobs
r.get("/jobs", requireAuth(), (req, res) => {
  const jobs = db.prepare(
    "SELECT * FROM jobs ORDER BY created_at DESC"
  ).all();

  res.render("jobs_list", {
    user: req.session.user,
    items: jobs,
    mode: "jobs"
  });
});

// Recommended jobs (requires payment)
r.get("/candidate/recommended", requirePaid("candidate"), (req, res) => {
  const profile = db.prepare(
    "SELECT * FROM candidate_profiles WHERE user_id = ?"
  ).get(req.session.user.id);

  const jobs = db.prepare(
    "SELECT * FROM jobs ORDER BY created_at DESC"
  ).all();

  const userSkills = (profile.skills || "")
    .toLowerCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const scored = jobs.map(j => {
    const jobSkills = (j.skills || "")
      .toLowerCase()
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const overlap = userSkills.filter(s => jobSkills.includes(s)).length;
    const eduMatch = profile.education?.toLowerCase() === j.education?.toLowerCase() ? 1 : 0;
    const expGap = Math.abs((profile.experience_years || 0) - (j.experience_years || 0));
    const expScore = Math.max(0, 5 - expGap);

    return { ...j, score: eduMatch * 3 + overlap * 2 + expScore };
  }).sort((a, b) => b.score - a.score);

  res.render("recommended", {
    user: req.session.user,
    items: scored
  });
});

export default r;
