// Unit: payment signature verification
// This is the most security-critical logic in the whole app — verified in
// complete isolation with no external HTTP calls.

process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret_1234567890";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_1234567890";
process.env.RAZORPAY_KEY_ID = "test_key_id";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

import crypto from "crypto";
import ApiError from "../../src/utils/apiError.js";

const { default: paymentService } = await import("../../src/services/payment.service.js");

describe("PaymentService — signature verification", () => {
  describe("verifyCheckoutSignature", () => {
    it("passes for a correctly generated signature", () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      // Build the exact same HMAC the real Razorpay would send
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      expect(() =>
        paymentService.verifyCheckoutSignature({
          orderId,
          paymentId,
          signature,
        })
      ).not.toThrow();
    });

    it("throws ApiError(400) for a wrong signature", () => {
      expect(() =>
        paymentService.verifyCheckoutSignature({
          orderId: "order_test123",
          paymentId: "pay_test456",
          signature: "completely_wrong",
        })
      ).toThrow(ApiError);
    });

    it("throws for a signature built with a different secret", () => {
      const orderId = "order_test123";
      const paymentId = "pay_test456";
      const wrongSig = crypto
        .createHmac("sha256", "wrong_secret")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      expect(() =>
        paymentService.verifyCheckoutSignature({
          orderId,
          paymentId,
          signature: wrongSig,
        })
      ).toThrow();
    });
  });

  describe("verifyWebhookSignature", () => {
    it("returns true for a valid webhook signature", () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const sig = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(payload)
        .digest("hex");

      expect(paymentService.verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it("returns false for an invalid webhook signature", () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      expect(paymentService.verifyWebhookSignature(payload, "fake_sig")).toBe(
        false
      );
    });
  });
});
