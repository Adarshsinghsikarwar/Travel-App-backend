import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import {
  getAdminDashboard,
  getTopRatedProviders,
  getPendingVerifications,
} from "../controllers/analytics.controller.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/dashboard", getAdminDashboard);
router.get("/top-providers", getTopRatedProviders);
router.get("/pending-verifications", getPendingVerifications);

export default router;
