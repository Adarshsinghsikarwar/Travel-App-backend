import express from "express";
import authRoutes from "./auth.routes.js";
import tripRoutes from "./trip.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/trips", tripRoutes);

export default router;
