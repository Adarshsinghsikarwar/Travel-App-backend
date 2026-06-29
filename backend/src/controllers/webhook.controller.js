import paymentService from "../services/payment.service.js";
import bookingService from "../services/booking.service.js";
import logger from "../utils/logger.js";

// Razorpay calls this server-to-server. req.body here is the RAW buffer
// (see app.js — this route is mounted BEFORE express.json() for this exact path)
// because signature verification must run over the exact raw bytes received.
async function razorpayWebhook(req, res) {
  const signature = req.headers["x-razorpay-signature"];
  const isValid = paymentService.verifyWebhookSignature(req.body, signature);

  if (!isValid) {
    logger.error("Razorpay webhook signature verification failed");
    return res
      .status(400)
      .json({ success: false, message: "Invalid signature" });
  }

  const event = JSON.parse(req.body.toString());

  try {
    if (event.event === "payment.captured") {
      const { order_id, id: paymentId } = event.payload.payment.entity;
      await bookingService.handleWebhookPaymentCaptured(order_id, paymentId);
    }
    // Always 200 quickly — Razorpay retries on non-2xx, and we don't want
    // retries piling up because of slow downstream processing.
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error(`Webhook processing error: ${err.message}`);
    return res.status(200).json({ received: true }); // ack anyway, log for manual follow-up
  }
}

export { razorpayWebhook };
