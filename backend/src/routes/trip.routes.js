import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { aiDraftValidator } from "../validators/trip.validator.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createTrip,
  getMyTrips,
  getTripById,
  updateTrip,
  deleteTrip,
  generateDraft,
} from "../controllers/trip.controller.js";

const router = express.Router();
router.use(requireAuth); // every trip route requires a valid access token

router.post("/ai-draft", aiDraftValidator, validate, generateDraft);
router.post("/", createTrip);
router.get("/", getMyTrips);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);
router.delete("/:id", deleteTrip);

export default router;
