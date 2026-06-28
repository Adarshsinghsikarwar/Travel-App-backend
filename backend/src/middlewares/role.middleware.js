import ApiError from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import userRepo from "../repositories/user.repository.js";

// Use after requireAuth. Usage: requireRole('admin')
const requireRole = (...allowedRoles) =>
  asyncHandler(async (req, res, next) => {
    const user = await userRepo.findById(req.userId);
    if (!user || !user.roles.some((role) => allowedRoles.includes(role))) {
      throw new ApiError(403, "You do not have permission to do this");
    }
    next();
  });

export { requireRole };
