// Integration: reviews
// Key rule being tested: only one review per completed booking,
// and only by the actual traveler on that booking.

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

import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Provider from "../../src/models/provider.model.js";
import Booking from "../../src/models/booking.model.js";
import User from "../../src/models/user.model.js";

let app, mongoServer;
let travelerToken, travelerId;
let providerToken, providerUserId;
let providerId, completedBookingId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = (await import("../../src/app.js")).default;

  // Setup traveler
  await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Traveler",
      email: "traveler@rev.com",
      password: "Test@1234",
    });
  await mongoose.model("User").findOneAndUpdate({ email: "traveler@rev.com" }, { isEmailVerified: true });
  const tLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "traveler@rev.com", password: "Test@1234" });
  travelerToken = tLogin.body.data.accessToken;
  travelerId = tLogin.body.data.userId;

  // Setup provider
  await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: "Provider",
      email: "provider@rev.com",
      password: "Test@1234",
    });
  await mongoose.model("User").findOneAndUpdate({ email: "provider@rev.com" }, { isEmailVerified: true });
  const pLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "provider@rev.com", password: "Test@1234" });
  providerToken = pLogin.body.data.accessToken;
  providerUserId = pLogin.body.data.userId;

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
  await User.findByIdAndUpdate(providerUserId, {
    $addToSet: { roles: "provider" },
  });

  // Create a completed booking directly in DB — avoids going through the full
  // payment flow (which needs real Razorpay keys) in this test file
  const booking = await Booking.create({
    traveler: travelerId,
    provider: providerId,
    startDate: new Date("2026-01-10"),
    endDate: new Date("2026-01-12"),
    amount: 2000,
    commissionAmount: 240,
    providerPayoutAmount: 1760,
    status: "completed",
    payment: { status: "paid", razorpayOrderId: "order_test" },
    respondBy: new Date(),
  });
  completedBookingId = booking._id.toString();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  await mongoose.connection.collections["reviews"]?.deleteMany({});
});

describe("POST /api/v1/reviews", () => {
  it("201 — traveler can review a completed booking", async () => {
    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({
        booking: completedBookingId,
        rating: 5,
        comment: "Excellent guide!",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(5);
  });

  it("409 — cannot review the same booking twice", async () => {
    await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ booking: completedBookingId, rating: 4 });

    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ booking: completedBookingId, rating: 5 });
    expect(res.status).toBe(409);
  });

  it("400 — rating must be between 1 and 5", async () => {
    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ booking: completedBookingId, rating: 6 });
    expect(res.status).toBe(400);
  });

  it("403 — provider cannot review their own booking", async () => {
    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ booking: completedBookingId, rating: 5 });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/reviews/provider/:providerId", () => {
  it("200 — returns all reviews for a provider (public, no auth)", async () => {
    await request(app)
      .post("/api/v1/reviews")
      .set("Authorization", `Bearer ${travelerToken}`)
      .send({ booking: completedBookingId, rating: 4, comment: "Good guide" });

    const res = await request(app).get(
      `/api/v1/reviews/provider/${providerId}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].rating).toBe(4);
  });
});
