// Integration: booking lifecycle
// Most complex test file — covers the state machine, ownership checks,
// payment signature rejection, and race-condition prevention.

process.env.ACCESS_TOKEN_SECRET = "test_access_secret_1234567890";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_1234567890";
process.env.ACCESS_TOKEN_EXPIRY = "15m";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.MONGO_URI = "placeholder";
process.env.GOOGLE_CLIENT_ID = "dummy";
process.env.GOOGLE_CLIENT_SECRET = "dummy";
process.env.GOOGLE_CALLBACK_URL = "http://localhost/callback";
process.env.RAZORPAY_KEY_ID = "dummy";
process.env.RAZORPAY_KEY_SECRET = "dummy";
process.env.RAZORPAY_WEBHOOK_SECRET = "dummy";
process.env.CLOUDINARY_CLOUD_NAME = "dummy";
process.env.CLOUDINARY_API_KEY = "dummy";
process.env.CLOUDINARY_API_SECRET = "dummy";
process.env.CLIENT_URL = "http://localhost:3000";
process.env.PLATFORM_COMMISSION_PERCENT = "12";

import { jest } from "@jest/globals";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Provider from "../../src/models/provider.model.js";
import User from "../../src/models/user.model.js";
import paymentService from "../../src/services/payment.service.js";

let app, mongoServer;
let travelerToken, providerToken;
let providerId, providerUserId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = (await import("../../src/app.js")).default;

  // Mock payment order creation
  jest.spyOn(paymentService, "createOrder").mockResolvedValue({ id: "fake_order_id" });

  // Register traveler
  await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Traveler",
      email: "traveler@test.com",
      password: "Test@1234",
    });
  await mongoose.model("User").findOneAndUpdate({ email: "traveler@test.com" }, { isEmailVerified: true });
  const tLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "traveler@test.com", password: "Test@1234" });
  travelerToken = tLogin.body.data.accessToken;

  // Register provider user
  await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Provider",
      email: "provider@test.com",
      password: "Test@1234",
    });
  await mongoose.model("User").findOneAndUpdate({ email: "provider@test.com" }, { isEmailVerified: true });
  const pLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "provider@test.com", password: "Test@1234" });
  providerToken = pLogin.body.data.accessToken;
  providerUserId = pLogin.body.data.userId;

  // Create + directly verify a provider (bypass admin flow for testing)
  const providerDoc = await Provider.create({
    user: providerUserId,
    serviceType: "guide",
    title: "Test Guide",
    pricePerDay: 1000,
    location: { type: "Point", coordinates: [73.8, 15.5], city: "Goa" },
    verificationStatus: "verified",
    isActive: true,
  });
  providerId = providerDoc._id.toString();

  // Add provider role to the user
  await User.findByIdAndUpdate(providerUserId, {
    $addToSet: { roles: "provider" },
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  // Only clear bookings between tests — keep users/provider intact
  await mongoose.connection.collections["bookings"]?.deleteMany({});
});

const bookingPayload = {
  provider: null, // filled in beforeEach
  startDate: "2026-03-10",
  endDate: "2026-03-12",
};

describe("POST /api/v1/bookings — create booking request", () => {
  it("201 — traveler can request a verified provider", async () => {
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ ...bookingPayload, provider: providerId });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("requested");
    // Amount = 2 days * 1000/day = 2000
    expect(res.body.data.amount).toBe(2000);
    expect(res.body.data.commissionAmount).toBe(240); // 12% of 2000
    expect(res.body.data.providerPayoutAmount).toBe(1760);
  });

  it("400 — cannot book your own provider profile", async () => {
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${providerToken}`) // the provider themselves
      .send({ ...bookingPayload, provider: providerId });
    expect(res.status).toBe(400);
  });

  it("400 — rejects startDate after endDate", async () => {
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({
        provider: providerId,
        startDate: "2026-03-15",
        endDate: "2026-03-10",
      });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/bookings/:id/respond", () => {
  let bookingId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ ...bookingPayload, provider: providerId });
    bookingId = res.body.data._id;
  });

  it("200 — provider can accept a booking request", async () => {
    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ decision: "accept" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("confirmed");
  });

  it("200 — provider can reject a booking request", async () => {
    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ decision: "reject" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("rejected");
  });

  it("403 — traveler cannot respond to their own booking request", async () => {
    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ decision: "accept" });
    expect(res.status).toBe(403);
  });

  it("409 — cannot respond to a booking that is already responded to", async () => {
    await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ decision: "accept" });

    // Try to respond again
    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ decision: "reject" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/bookings/:id/verify-payment — signature check", () => {
  it("400 — rejects a fake payment signature", async () => {
    const create = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ ...bookingPayload, provider: providerId });
    const bookingId = create.body.data._id;

    await request(app)
      .patch(`/api/v1/bookings/${bookingId}/respond`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ decision: "accept" });

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/verify-payment`)
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({
        orderId: "order_fake",
        paymentId: "pay_fake",
        signature: "wrong_sig",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature/i);
  });
});

describe("PATCH /api/v1/bookings/:id/cancel", () => {
  it("200 — traveler can cancel their own booking", async () => {
    const create = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ ...bookingPayload, provider: providerId });
    const bookingId = create.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ reason: "Change of plans" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
  });

  it("403 — a random user cannot cancel someone else's booking", async () => {
    const create = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ ...bookingPayload, provider: providerId });
    const bookingId = create.body.data._id;

    // Register a completely unrelated third user
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Stranger",
        email: "stranger@test.com",
        password: "Test@1234",
      });
    await mongoose.model("User").findOneAndUpdate({ email: "stranger@test.com" }, { isEmailVerified: true });
    const stranger = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "stranger@test.com", password: "Test@1234" });

    const res = await request(app)
      .patch(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${stranger.body.data.accessToken}`)
      .send({ reason: "Malicious cancel" });
    expect(res.status).toBe(403);
  });
});
