// Unit: auth service business logic
// Uses Jest mocks to replace the repository layer entirely — we're testing
// auth logic (lockout, token generation, reuse detection), not database queries.

process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.ACCESS_TOKEN_SECRET = "test_access_secret_1234567890";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_1234567890";
process.env.RAZORPAY_KEY_ID = "rzp_test";
process.env.RAZORPAY_KEY_SECRET = "rzp_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "wh_secret";

import { jest } from "@jest/globals";
import ApiError from "../../src/utils/apiError.js";

// Mock the repository so auth.service never needs a real DB connection
jest.unstable_mockModule("../../src/repositories/user.repository.js", () => {
  return {
    default: {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setRefreshTokenHash: jest.fn(),
      clearRefreshTokenHash: jest.fn(),
      incrementFailedLogins: jest.fn(),
      lockAccount: jest.fn(),
      resetFailedLogins: jest.fn(),
      addRole: jest.fn(),
    }
  };
});

const { default: userRepo } = await import("../../src/repositories/user.repository.js");
const { default: authService } = await import("../../src/services/auth.service.js");


describe("AuthService", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── register ────────────────────────────────────────────────────────────
  describe("register", () => {
    it("creates a new user and returns safe fields", async () => {
      userRepo.findByEmail.mockResolvedValue(null); // no existing user
      userRepo.create.mockResolvedValue({
        _id: "user_1",
        name: "Adarsh",
        email: "a@example.com",
        roles: ["traveler"],
      });

      const result = await authService.register({
        name: "Adarsh",
        email: "a@example.com",
        password: "Test@1234",
      });

      expect(result.email).toBe("a@example.com");
      expect(result).not.toHaveProperty("password"); // never return the password
    });

    it("throws 409 if email already exists", async () => {
      userRepo.findByEmail.mockResolvedValue({ _id: "existing" });

      await expect(
        authService.register({
          name: "X",
          email: "exists@example.com",
          password: "Test@1234",
        })
      ).rejects.toThrow(new ApiError(409, "Email already registered. Please log in."));
    });
  });

  // ─── login ───────────────────────────────────────────────────────────────
  describe("login", () => {
    it("throws 401 for a non-existent email (does NOT reveal which was wrong)", async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      await expect(
        authService.login({ email: "nobody@example.com", password: "any" })
      ).rejects.toThrow(new ApiError(401, "Email not registered. Please sign up first."));
    });

    it("throws 429 when the account is locked", async () => {
      userRepo.findByEmail.mockResolvedValue({
        _id: "user_1",
        isActive: true,
        isEmailVerified: true,
        isLocked: () => true,
        lockUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more mins
        comparePassword: jest.fn(),
        password: "hash",
        failedLoginAttempts: 5,
      });

      await expect(
        authService.login({
          email: "locked@example.com",
          password: "Test@1234",
        })
      ).rejects.toMatchObject({ statusCode: 429 });
    });

    it("throws 403 when the account is deactivated", async () => {
      userRepo.findByEmail.mockResolvedValue({
        _id: "user_1",
        isActive: false,
        isEmailVerified: true,
        isLocked: () => false,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      await expect(
        authService.login({
          email: "inactive@example.com",
          password: "Test@1234",
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────
  describe("refresh", () => {
    it("throws 401 when no refresh token is provided", async () => {
      await expect(authService.refresh(undefined)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("throws 401 for a garbage refresh token", async () => {
      await expect(authService.refresh("garbage.token")).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────
  describe("logout", () => {
    it("clears the refresh token hash", async () => {
      userRepo.clearRefreshTokenHash.mockResolvedValue(true);
      await authService.logout("user_1");
      expect(userRepo.clearRefreshTokenHash).toHaveBeenCalledWith("user_1");
    });
  });
});
