import bcrypt from "bcryptjs";
import userRepo from "../repositories/user.repository.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/token.util.js";
import notificationService from "./notification.service.js";
import logger from "../utils/logger.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AuthService {
  async register({ name, email, password }) {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      if (existing.authProvider === "google") {
        throw new ApiError(
          409,
          "This email is already registered via Google OAuth. Please log in using Google.",
        );
      }
      throw new ApiError(409, "Email already registered. Please log in.");
    }

    // Generate a random 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    const user = await userRepo.create({
      name,
      email,
      password,
      verificationOtp: otp,
      verificationOtpExpires: otpExpires,
      isEmailVerified: false, // Must verify first
    });

    // Send email using the pre-configured Brevo utility
    notificationService
      .sendEmail({
        to: user.email,
        subject: "Verify Your TripConnect Account",
        text: `Hi ${user.name},\n\nThank you for registering at TripConnect! Please use the following 6-digit verification code to complete your signup:\n\n${otp}\n\nThis code will expire in 15 minutes.\n\nBest regards,\nThe TripConnect Team`,
      })
      .catch((err) =>
        logger.error(
          `Failed to send verification email to ${user.email}: ${err.message}`,
        ),
      );

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      isEmailVerified: false,
    };
  }

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email, true);
    if (!user) {
      throw new ApiError(401, "Email not registered. Please sign up first.");
    }

    // Redirect Google-created accounts to Google Login
    if (user.authProvider === "google") {
      throw new ApiError(
        401,
        "This account is registered via Google OAuth. Please log in using Google.",
      );
    }

    // Block login if email is not verified
    if (!user.isEmailVerified) {
      throw new ApiError(403, "Please verify your email address to log in.");
    }

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new ApiError(
        429,
        `Account temporarily locked. Try again in ${minutesLeft} minute(s)`,
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
          new Date(Date.now() + LOCK_DURATION_MS),
        );
        throw new ApiError(
          429,
          "Too many failed attempts. Account locked for 15 minutes",
        );
      }
      throw new ApiError(401, "Incorrect password");
    }

    await userRepo.resetFailedLogins(user._id);

    // Send login alert
    notificationService
      .sendEmail({
        to: user.email,
        subject: "TripConnect Login Notification",
        text: `Hi ${user.name},\n\nWe detected a new login to your TripConnect account on ${new Date().toLocaleString()}.\n\nBest regards,\nThe TripConnect Team`,
      })
      .catch((err) =>
        logger.error(`Failed to send login alert: ${err.message}`),
      );

    return this._issueTokenPair(user._id);
  }

  // Used by the Google OAuth callback — no password check, identity is already
  // verified by Google. We still issue our own access/refresh pair so every
  // protected route only needs to understand one auth mechanism (our JWT).
  async loginWithOAuthUser(user) {
    if (!user.isActive)
      throw new ApiError(403, "This account has been deactivated");

    // Send login alert email asynchronously
    notificationService
      .sendEmail({
        to: user.email,
        subject: "TripConnect Login Notification",
        text: `Hi ${user.name},\n\nWe detected a new login to your TripConnect account via Google OAuth on ${new Date().toLocaleString()}.\n\nIf this was not you, please secure your account immediately.\n\nBest regards,\nThe TripConnect Team`,
      })
      .catch((err) =>
        logger.error(
          `Failed to send Google login alert to ${user.email}: ${err.message}`,
        ),
      );

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
      user.refreshTokenHash,
    );
    if (!isValid) {
      // Reuse of an already-rotated token = likely theft. Kill the whole session.
      await userRepo.clearRefreshTokenHash(user._id);
      throw new ApiError(
        401,
        "Refresh token reuse detected, please log in again",
      );
    }

    return this._issueTokenPair(user._id);
  }

  async logout(userId) {
    await userRepo.clearRefreshTokenHash(userId);
  }

  async verifyOtp({ email, otp }) {
    const user = await userRepo.findByEmail(email);
    if (!user) throw new ApiError(404, "User not found");

    // Fetch the hidden OTP fields explicitly
    const fullUser = await User
      .findById(user._id)
      .select("+verificationOtp +verificationOtpExpires");

    if (fullUser.isEmailVerified) {
      throw new ApiError(400, "Email is already verified");
    }

    if (!fullUser.verificationOtp || fullUser.verificationOtp !== otp) {
      throw new ApiError(400, "Invalid verification code");
    }

    if (fullUser.verificationOtpExpires < new Date()) {
      throw new ApiError(
        400,
        "Verification code has expired. Please request a new one.",
      );
    }

    // Mark as verified
    fullUser.isEmailVerified = true;
    fullUser.verificationOtp = null;
    fullUser.verificationOtpExpires = null;
    await fullUser.save();

    return { message: "Email verified successfully. You can now log in." };
  }

  async resendOtp({ email }) {
    const user = await userRepo.findByEmail(email);
    if (!user) throw new ApiError(404, "User not found");

    if (user.isEmailVerified) {
      throw new ApiError(400, "Email is already verified");
    }

    // Generate new code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    const fullUser = await User
      .findById(user._id)
      .select("+verificationOtp +verificationOtpExpires");
    fullUser.verificationOtp = otp;
    fullUser.verificationOtpExpires = otpExpires;
    await fullUser.save();

    // Send new email
    notificationService
      .sendEmail({
        to: user.email,
        subject: "New Verification Code",
        text: `Hi ${user.name},\n\nYour new verification code is:\n\n${otp}\n\nThis code will expire in 15 minutes.\n\nBest regards,\nThe TripConnect Team`,
      })
      .catch((err) =>
        logger.error(`Failed to resend verification email: ${err.message}`),
      );

    return { message: "A new verification code has been sent to your email." };
  }

    // Add this to the AuthService class in backend/src/services/auth.service.js

  async forgotPassword({ email }) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Email not registered. Please sign up first.');
    }

    if (user.authProvider === 'google') {
      throw new ApiError(401, 'This account is registered via Google OAuth. Please log in using Google.');
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    const fullUser = await User.findById(user._id).select('+resetPasswordOtp +resetPasswordOtpExpires');
    fullUser.resetPasswordOtp = otp;
    fullUser.resetPasswordOtpExpires = otpExpires;
    await fullUser.save();

    // Send reset code via Brevo
    notificationService.sendEmail({
      to: user.email,
      subject: 'Reset Your TripConnect Password',
      text: `Hi ${user.name},\n\nWe received a request to reset your password. Please use the following 6-digit verification code to reset it:\n\n${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.\n\nBest regards,\nThe TripConnect Team`
    }).catch(err => logger.error(`Failed to send password reset email: ${err.message}`));

    return { message: 'A password reset code has been sent to your email.' };
  }

  async resetPassword({ email, otp, newPassword }) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const fullUser = await User.findById(user._id).select('+resetPasswordOtp +resetPasswordOtpExpires');

    if (!fullUser.resetPasswordOtp || fullUser.resetPasswordOtp !== otp) {
      throw new ApiError(400, 'Invalid verification code');
    }

    if (fullUser.resetPasswordOtpExpires < new Date()) {
      throw new ApiError(400, 'Verification code has expired. Please request a new one.');
    }

    // Update password and clear OTP fields
    fullUser.password = newPassword; // Automatically hashed by Mongoose schema pre-save hook
    fullUser.resetPasswordOtp = null;
    fullUser.resetPasswordOtpExpires = null;
    await fullUser.save();

    // Clear refresh tokens so they are logged out of all active sessions
    await userRepo.clearRefreshTokenHash(user._id);

    return { message: 'Password reset successfully. You can now log in with your new password.' };
  }


  async _issueTokenPair(userId) {
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await userRepo.setRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken, userId };
  }
}

export default new AuthService();
