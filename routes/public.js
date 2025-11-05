import { Router } from "express";
const r = Router();

r.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

r.get("/login", (req, res) => {
  res.render("login", { user: req.session.user, error: null });
});

r.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

export default r;
