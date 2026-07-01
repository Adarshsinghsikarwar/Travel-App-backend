import authService from "../services/auth.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import { nodeEnv, clientUrl } from "../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: nodeEnv === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function sendTokenResponse(
  res,
  { accessToken, refreshToken, userId },
  message,
  status = 200
) {
  res
    .cookie("refreshToken", refreshToken, cookieOptions)
    .status(status)
    .json(new ApiResponse(status, { accessToken, userId }, message));
}

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json(new ApiResponse(201, user, "Registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const tokens = await authService.login(req.body);
  sendTokenResponse(res, tokens, "Logged in successfully");
});

// GET /auth/google/callback — passport already authenticated the user (session: false),
// req.user is the Mongo user document set in passport.js's verify callback.
const googleCallback = asyncHandler(async (req, res) => {
  const tokens = await authService.loginWithOAuthUser(req.user);

  res.cookie("refreshToken", tokens.refreshToken, cookieOptions);
  // Redirect to frontend with the access token as a query param (short-lived,
  // frontend should immediately store it in memory and strip it from the URL).
  res.redirect(`${clientUrl}/auth/callback?accessToken=${tokens.accessToken}`);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const resendOtp = asyncHandler(async (req, res) => {
  const result = await authService.resendOtp(req.body);
  res.status(200).json(new ApiResponse(200, null, result.message));
});

const refresh = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken;
  const tokens = await authService.refresh(incoming);
  sendTokenResponse(res, tokens, "Token refreshed");
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.userId);
  res
    .clearCookie("refreshToken", cookieOptions)
    .status(200)
    .json(new ApiResponse(200, null, "Logged out successfully"));
});

export {
  register,
  login,
  googleCallback,
  refresh,
  logout,
  verifyOtp,
  resendOtp,
};
