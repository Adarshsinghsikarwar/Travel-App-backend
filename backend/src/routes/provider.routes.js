import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
  createProviderValidator,
  searchProviderValidator,
} from "../validators/provider.validator.js";
import {
  registerProvider,
  getProvider,
  searchProviders,
  updateProvider,
  uploadPhotos,
  setVerification,
} from "../controllers/provider.controller.js";

const router = express.Router();

router.get("/search", searchProviderValidator, validate, searchProviders); // public
router.get("/:id", getProvider); // public profile view

router.use(requireAuth);
router.post("/", createProviderValidator, validate, registerProvider);
router.patch("/:id", updateProvider);
router.post("/:id/photos", upload.array("photos", 5), uploadPhotos);

// Admin-only verification action
router.patch("/:id/verify", requireRole("admin"), setVerification);

export default router;
