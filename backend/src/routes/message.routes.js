import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { sendMessage, getThread } from "../controllers/message.controller.js";

const router = express.Router();
router.use(requireAuth);

router.post("/:bookingId", sendMessage);
router.get("/:bookingId", getThread);

module.exports = router;
