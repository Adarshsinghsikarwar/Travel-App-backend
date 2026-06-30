import express from "express";
import authRoutes from "./auth.routes.js";
import tripRoutes from "./trip.routes.js";
import expenseRoutes from "./expenses.route.js";
import analyticsRoutes from "./analytics.routes.js";
import providerRoutes from "./provider.routes.js";
import bookingRoutes from "./booking.routes.js";
import reviewRoutes from "./review.routes.js";
import itineraryRoutes from "./itinerary.routes.js";
import assistantRoutes from "./assistant.routes.js";
import messageRoutes from "./message.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/trips", tripRoutes);
router.use("/itineraries", itineraryRoutes);
router.use("/expenses", expenseRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/providers", providerRoutes);
router.use("/bookings", bookingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/messages", messageRoutes);
router.use("/assistant", assistantRoutes);

export default router;
