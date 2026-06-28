import analyticsService from "../services/analytics.review.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

const getAdminDashboard = asyncHandler(async (req, res) => {
  const [data] = await analyticsService.getAdminDashboard();
  res.status(200).json(new ApiResponse(200, data));
});

const getTopRatedGuides = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTopRatedGuides();
  res.status(200).json(new ApiResponse(200, data));
});

export { getAdminDashboard, getTopRatedGuides };
