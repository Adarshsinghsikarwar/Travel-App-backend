import Razorpay from "razorpay";
import crypto from "crypto";
import { razorpay as cfg } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const razorpay = new Razorpay({ key_id: cfg.keyId, key_secret: cfg.keySecret });

class PaymentService {
  // Create an order BEFORE the user pays. Amount is in paise (smallest unit).
  async createOrder({ amount, currency = "INR", receipt }) {
    return razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
    });
  }

  // Verifies the signature Razorpay sends back after checkout completes.
  // NEVER trust payment success based on the frontend alone — frontend JS
  // can be tampered with; this HMAC check is the actual source of truth.

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const expected = crypto
      .createHmac("sha256", cfg.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      throw new ApiError(400, "Payment signature verification failed");
    }
    return true;
  }

  // Verifies the signature on incoming WEBHOOK payloads (separate secret from
  // checkout signature — configured in the Razorpay dashboard webhook settings).
  // This is what actually confirms payment server-to-server, independent of
  // whether the user's browser ever returns to your site.

  verifyWebhookSignature(rawBody, signatureHeader) {
    const expected = crypto
      .createHmac("sha256", cfg.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return expected === signatureHeader;
  }
  async refund(paymentId, amount) {
    return razorpay.payments.refund(paymentId, {
      amount: Math.round(amount * 100),
    });
  }
}

export default new PaymentService();
