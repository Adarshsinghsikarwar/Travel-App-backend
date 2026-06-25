import authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { nodeEnv } from "../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: nodeEnv === "production", // requires HTTPS in prod
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches REFRESH_TOKEN_EXPIRY
};

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json(new ApiResponse(200, user, "Registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, userId } = await authService.login(
    req.body
  );

  res
    .cookie("refreshToken", refreshToken, cookieOptions)
    .status(200)
    .json(
      new ApiResponse(200, { accessToken, userId }, "Logged in successfully")
    );
});

// Client calls this when a protected request returns 401 (access token expired)

const refresh = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken;
  const { accessToken, refreshToken, userId } = await authService.refresh(
    incoming
  );

  res
    .cookie("refreshToken", refreshToken, cookieOptions)
    .status(200)
    .json(new ApiResponse(200, { accessToken, userId }, "Token refreshed"));
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.userId);
  res
    .clearCookie("refreshToken", cookieOptions)
    .status(200)
    .json(200, null, "Logged out successfully");
});

export { register, login, refresh, logout };
