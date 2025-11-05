import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../config/db.js";

const r = Router();

// Login POST
r.post("/login", (req, res) => {
  const { email, password, role } = req.body;

  const user = db.prepare(
    "SELECT * FROM users WHERE email = ? AND role = ?"
  ).get(email, role);

  if (!user) {
    return res.render("login", { user: null, error: "User not found" });
  }

  const okay = bcrypt.compareSync(password, user.password_hash);
  if (!okay) {
    return res.render("login", { user: null, error: "Invalid password" });
  }

  // Store in session
  req.session.user = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  return role === "employer"
    ? res.redirect("/employer/dashboard")
    : res.redirect("/candidate/dashboard");
});


export default r;
