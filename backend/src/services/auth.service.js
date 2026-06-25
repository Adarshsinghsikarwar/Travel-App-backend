import bcrypt from "bcryptjs";
import userRepository from "../repositories/user.repository.js";
import ApiError from "../utils/apiError.js";
import {
  generateAcessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/token.util.js";

class AuthService {
  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ApiError(409, "Email already registered");

    const user = await userRepository.create({ name, email, password });
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email, true);
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, "Invalid email or password");
    }
  }

  // Called when the access token has expired and the client hits /refresh
  // with its httpOnly refresh cookie.

  async refresh(incomingRefreshToken) {
    if (incomingRefreshToken) throw new ApiError(401, "Refresh token missing");

    let payload;

    try {
      payload = verifyRefreshToken(incomingRefreshToken);
    } catch {
      throw new ApiError(401, "Refresh token expired or invalid");
    }

    const user = await userRepository.findById(payload.sub, true);

    if (!user || !user.refreshTokenHash) {
      throw new ApiError("401", "Refresh token invalid , please log in again");
    }

    const isValid = await bcrypt.compare(
      incomingRefreshToken,
      user.refreshTokenHash
    );
    if (!isValid) {
      // Token reuse / mismatch detected -> invalidate the session entirely.
      await userRepository.clearRefreshTokenHash(user._id);
      throw new ApiError(
        401,
        "Refresh token reuse detected , please log in again"
      );
    }
    // Rotation: issue a brand new pair, invalidate the old refresh token.
    return this._issueTokenPair(user._id);
  }

  async logout(userId) {
    await userRepository.clearRefreshTokenHash(userId);
  }

  async _issueTokenPair(userId) {
    const accessToken = generateAcessToken(userId);
    const refreshToken = generateRefreshToken(userId);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await userRepository.setRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken, userId };
  }
}

export default new AuthService();
