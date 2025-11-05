import { Router } from "express";
import Razorpay from "razorpay";
import dayjs from "dayjs";
import { db } from "../config/db.js";
import { requireAuth } from "../utils/access.js";

const r = Router();

const razor = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PRICE = 9900; // ₹99.00 in paise

// Checkout page (payment button)
r.get("/checkout", requireAuth(), (req, res) => {
  res.render("checkout", {
    user: req.session.user,
    price: 99,
    keyId: process.env.RAZORPAY_KEY_ID
  });
});

// Razorpay order
r.post("/create-order", requireAuth(), async (req, res) => {
  const order = await razor.orders.create({
    amount: PRICE,
    currency: "INR",
    receipt: "order_" + Date.now()
  });

  const expires = dayjs().add(1, "hour").format("YYYY-MM-DD HH:mm:ss");

  db.prepare(
    "INSERT INTO payments (user_id, role, order_id, status, amount_paise, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    req.session.user.id,
    req.session.user.role,
    order.id,
    "created",
    PRICE,
    expires
  );

  res.json({ orderId: order.id });
});

// Payment success
r.post("/payment/success", requireAuth(), (req, res) => {
  const { razorpay_order_id, razorpay_payment_id } = req.body;

  db.prepare(
    "UPDATE payments SET payment_id=?, status='paid' WHERE order_id=?"
  ).run(razorpay_payment_id, razorpay_order_id);

  return req.session.user.role === "employer"
    ? res.redirect("/employer/recommended")
    : res.redirect("/candidate/recommended");
});

export default r;