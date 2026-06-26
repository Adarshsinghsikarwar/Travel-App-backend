import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  createTrip,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
} from "../controllers/trip.controller.js";

const router = express.Router();
router.use(requireAuth); // every trip route requires a valid access token

router.post("/", createTrip);
router.get("/", getMyTrips);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);
router.delete("/:id", deleteTrip);

export default router;
