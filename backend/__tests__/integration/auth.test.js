// Integration: auth endpoints
// Boots the full Express app against an in-memory MongoDB.
// Tests the complete path: HTTP request -> middleware -> controller -> service -> real DB.

process.env.ACCESS_TOKEN_SECRET = "test_access_secret_1234567890";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_1234567890";
process.env.ACCESS_TOKEN_EXPIRY = "15m";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.MONGO_URI = "placeholder"; // overridden by MongoMemoryServer below
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

import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let app;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  // Patch the URI before app.js loads so mongoose connects to in-memory DB
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = (await import("../../src/app.js")).default;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections between tests — each test gets a clean state
  const collections = mongoose.connection.collections;
  for (const key in collections) await collections[key].deleteMany({});
});

const validUser = {
  name: "Adarsh Singh",
  email: "adarsh@example.com",
  password: "Test@1234",
};

// ─── REGISTER ──────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/register", () => {
  it("201 — registers a new user and returns safe fields", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(validUser.email);
    expect(res.body.data).not.toHaveProperty("password");
    expect(res.body.data.roles).toContain("traveler");
  });

  it("409 — rejects duplicate email", async () => {
    await request(app).post("/api/v1/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send(validUser);
    expect(res.status).toBe(409);
  });

  it("400 — rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validUser, email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it("400 — rejects password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validUser, password: "123" });
    expect(res.status).toBe(400);
  });

  it("400 — rejects password with no number", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validUser, password: "NoNumber!" });
    expect(res.status).toBe(400);
  });

  it("400 — rejects NoSQL injection in email field", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "X", email: { $gt: "" }, password: "Test@1234" });
    expect(res.status).toBe(400); // sanitized to empty string -> fails email validation
  });
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/auth/register").send(validUser);
    await mongoose.model("User").findOneAndUpdate({ email: validUser.email }, { isEmailVerified: true });
  });

  it("200 — returns accessToken and sets refreshToken cookie", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/refreshToken/);
    expect(cookie).toMatch(/HttpOnly/); // must be httpOnly — readable by JS is a security hole
  });

  it("401 — wrong password returns 401", async () => {
    const wrongPass = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: validUser.email, password: "Wrong@1234" });
    const wrongEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: validUser.password });

    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
  });

  it("429 — locks account after 5 consecutive failed logins", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/v1/auth/login")
        .send({ email: validUser.email, password: "Wrong@1234" });
    }
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: validUser.email, password: validUser.password }); // correct password now
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/locked/i);
  });
});

// ─── REFRESH ───────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/refresh", () => {
  it("200 — issues a new accessToken when a valid refresh cookie is present", async () => {
    await request(app).post("/api/v1/auth/register").send(validUser);
    await mongoose.model("User").findOneAndUpdate({ email: validUser.email }, { isEmailVerified: true });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    const cookie = login.headers["set-cookie"];
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    // New token must be different from the original (rotation working)
    expect(res.body.data.accessToken).not.toBe(login.body.data.accessToken);
  });

  it("401 — fails with no refresh cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });
});

// ─── LOGOUT ────────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/logout", () => {
  it("200 — logs out and the old token is no longer usable for refresh", async () => {
    await request(app).post("/api/v1/auth/register").send(validUser);
    await mongoose.model("User").findOneAndUpdate({ email: validUser.email }, { isEmailVerified: true });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    const { accessToken } = login.body.data;
    const cookie = login.headers["set-cookie"];

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(logout.status).toBe(200);

    // Refresh with the old cookie after logout must fail
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie);
    expect(refresh.status).toBe(401);
  });

  it("401 — rejects request without access token", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(401);
  });
});

// ─── PROTECTED ROUTE ───────────────────────────────────────────────────────
describe("Protected route behaviour", () => {
  it("401 — no token", async () => {
    const res = await request(app).get("/api/v1/trips");
    expect(res.status).toBe(401);
  });

  it("401 — garbage token", async () => {
    const res = await request(app)
      .get("/api/v1/trips")
      .set("Authorization", "Bearer garbage.token.here");
    expect(res.status).toBe(401);
  });
});
