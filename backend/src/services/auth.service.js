import bcrypt from "bcryptjs";
import userRepo from "../repositories/user.repository.js";
import ApiError from "../utils/apiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/token.util.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  async register({ name, email, password }) {
    const existing = await userRepo.findByEmail(email);
    if (existing) throw new ApiError(409, "Email already registered");

    const user = await userRepo.create({ name, email, password });
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    };
  }

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email, true);
    if (!user) throw new ApiError(401, "Invalid email or password");

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new ApiError(
        429,
        `Account temporarily locked. Try again in ${minutesLeft} minute(s)`
      );
    }

    if (!user.isActive)
      throw new ApiError(403, "This account has been deactivated");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const updated = await userRepo.incrementFailedLogins(user._id);
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await userRepo.lockAccount(
          user._id,
          new Date(Date.now() + LOCK_DURATION_MS)
        );
        throw new ApiError(
          429,
          "Too many failed attempts. Account locked for 15 minutes"
        );
      }
      throw new ApiError(401, "Invalid email or password");
    }

    await userRepo.resetFailedLogins(user._id);
    return this._issueTokenPair(user._id);
  }

  // Used by the Google OAuth callback — no password check, identity is already
  // verified by Google. We still issue our own access/refresh pair so every
  // protected route only needs to understand one auth mechanism (our JWT).
  async loginWithOAuthUser(user) {
    if (!user.isActive)
      throw new ApiError(403, "This account has been deactivated");
    return this._issueTokenPair(user._id);
  }

  async refresh(incomingRefreshToken) {
    if (!incomingRefreshToken) throw new ApiError(401, "Refresh token missing");

    let payload;
    try {
      payload = verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw new ApiError(401, "Refresh token expired or invalid");
    }

    const user = await userRepo.findById(payload.sub, true);
    if (!user || !user.refreshTokenHash) {
      throw new ApiError(401, "Refresh token invalid, please log in again");
    }

    const isValid = await bcrypt.compare(
      incomingRefreshToken,
      user.refreshTokenHash
    );
    if (!isValid) {
      // Reuse of an already-rotated token = likely theft. Kill the whole session.
      await userRepo.clearRefreshTokenHash(user._id);
      throw new ApiError(
        401,
        "Refresh token reuse detected, please log in again"
      );
    }

    return this._issueTokenPair(user._id);
  }

  async logout(userId) {
    await userRepo.clearRefreshTokenHash(userId);
  }

  async _issueTokenPair(userId) {
    const accessToken =  generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await userRepo.setRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken, userId };
  }
}

export default new AuthService();
