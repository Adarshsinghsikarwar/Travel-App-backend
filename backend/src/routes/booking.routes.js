import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { createBookingValidator } from "../validators/booking.validator.js";
import {
  createBooking,
  respondToRequest,
  verifyPayment,
  cancelBooking,
  markCompleted,
  myBookingsAsTraveler,
  myBookingsAsProvider,
} from "../controllers/booking.controller.js";

const router = express.Router();
router.use(requireAuth);

router.post("/", createBookingValidator, validate, createBooking);
router.get("/mine/traveler", myBookingsAsTraveler);
router.get("/mine/provider", myBookingsAsProvider);
router.patch("/:id/respond", respondToRequest); // provider accepts/rejects
router.post("/:id/verify-payment", verifyPayment); // traveler confirms checkout
router.patch("/:id/cancel", cancelBooking);
router.patch("/:id/complete", markCompleted); // provider marks trip done

export default router;
