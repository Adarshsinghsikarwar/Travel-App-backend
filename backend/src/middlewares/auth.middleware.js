import ApiError from "../utils/apiError.js";
import { verifyAccessToken } from "../utils/token.util.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Protects routes: expects "Authorization: Bearer <accessToken>"
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startWith("Bearer ")) {
    throw new ApiError(401, "Access token missing");
  }
  const token = header.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
  } catch {
    // Client should catch this 401 and call /auth/refresh to get a new access token
    throw new ApiError(401, "Access token expired or invalid");
  }
  next();
});

export { requireAuth };
