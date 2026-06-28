import express from "express";
import authRoutes from "./auth.routes.js";
import tripRoutes from "./trip.routes.js";
import expenseRoutes from "./expenses.route.js";
import analyticsRoutes from "./analytics.routes.js";
import providerRoutes from "./provider.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/trips", tripRoutes);
router.use("/expenses", expenseRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/providers", providerRoutes);

export default router;
