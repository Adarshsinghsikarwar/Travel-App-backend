import ApiError from "../utils/apiError.js";

// Centralized error handler. Every thrown ApiError (and unexpected errors)
// land here via asyncHandler, so controllers stay free of try/catch.

function errorMiddleware(err, req, res, next) {
  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message });
  }

  console.log(err);
  return res
    .status(500)
    .json({ success: false, message: "Internal server error" });
}

export { errorMiddleware };
