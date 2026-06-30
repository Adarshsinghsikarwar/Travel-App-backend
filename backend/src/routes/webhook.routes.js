import express from "express";
import { razorpayWebhook } from "../controllers/webhook.controller.js";

const router = express.Router();
// NOTE: raw body parsing for this path is configured in app.js, before express.json()

router.post("/razorpay", razorpayWebhook);
export default router;
