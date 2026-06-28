import ApiError from "../utils/apiError.js";
import logger from "../utils/logger.js";
import { nodeEnv } from "../config/env.js";

// Centralized error handler. Every thrown ApiError (and unexpected errors)
// land here via asyncHandler, so controllers stay free of try/catch.

function errorMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message });
  }

  // Known Mongoose/Mongo error shapes get a clean message instead of leaking internals
  if (err.code === 11000) {
    return res
      .status(409)
      .json({
        success: false,
        message: "Duplicate value — resource already exists",
      });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === "CastError") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid id format" });
  }

  logger.error(err.stack || err.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    // Never leak stack traces to clients in production
    ...(nodeEnv !== "production" && { stack: err.stack }),
  });
}

export { errorMiddleware };
