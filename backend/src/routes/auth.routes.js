import express from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh); // reads refreshToken cookie, no access token needed
router.post("/logout", requireAuth, logout);

export default router;
