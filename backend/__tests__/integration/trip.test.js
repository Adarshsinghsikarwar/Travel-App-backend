// Integration: trip endpoints
// Full HTTP -> controller -> service -> real in-memory DB flow.

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

import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let app, mongoServer, accessToken, accessToken2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGO_URI);
  app = (await import("../../src/app.js")).default;

  // Register two users — used to verify ownership isolation
  await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "User1", email: "u1@test.com", password: "Test@1234" });
  await mongoose.model("User").findOneAndUpdate({ email: "u1@test.com" }, { isEmailVerified: true });
  const login1 = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "u1@test.com", password: "Test@1234" });
  accessToken = login1.body.data.accessToken;

  await request(app)
    .post("/api/v1/auth/register")
    .send({ name: "User2", email: "u2@test.com", password: "Test@1234" });
  await mongoose.model("User").findOneAndUpdate({ email: "u2@test.com" }, { isEmailVerified: true });
  const login2 = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: "u2@test.com", password: "Test@1234" });
  accessToken2 = login2.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

const validTrip = {
  title: "Goa Beach Trip",
  destination: "Goa",
  startDate: "2026-03-10",
  endDate: "2026-03-15",
  budget: 15000,
};

describe("POST /api/v1/trips", () => {
  it("201 — creates a trip for the logged-in user", async () => {
    const res = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    expect(res.status).toBe(201);
    expect(res.body.data.destination).toBe("Goa");
    expect(res.body.data.status).toBe("planned");
  });

  it("400 — rejects when endDate is before startDate", async () => {
    const res = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...validTrip, startDate: "2026-03-15", endDate: "2026-03-10" });
    expect(res.status).toBe(400);
  });

  it("400 — rejects missing required fields", async () => {
    const res = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Incomplete" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/trips", () => {
  it("returns only trips belonging to the logged-in user", async () => {
    // Create one trip for each user
    await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken2}`)
      .send({ ...validTrip, title: "User2 Trip" });

    const res = await request(app)
      .get("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    // User1 must not see User2's trip
    const titles = res.body.data.map((t) => t.title);
    expect(titles).not.toContain("User2 Trip");
  });

  it("supports ?destination filter", async () => {
    await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validTrip,
        title: "Manali Winter Trip",
        destination: "Manali",
      });

    const res = await request(app)
      .get("/api/v1/trips?destination=Manali")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((t) => expect(t.destination).toBe("Manali"));
  });
});

describe("GET /api/v1/trips/:id", () => {
  it("403 — user cannot access another user's trip", async () => {
    const create = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    const tripId = create.body.data._id;

    const res = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${accessToken2}`); // different user
    expect(res.status).toBe(403);
  });

  it("404 — nonexistent trip id", async () => {
    const res = await request(app)
      .get("/api/v1/trips/000000000000000000000001")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/trips/:id", () => {
  it("200 — owner can update their own trip", async () => {
    const create = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    const tripId = create.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ budget: 20000 });
    expect(res.status).toBe(200);
    expect(res.body.data.budget).toBe(20000);
  });

  it("404 — another user cannot update this trip", async () => {
    const create = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    const tripId = create.body.data._id;

    const res = await request(app)
      .patch(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${accessToken2}`)
      .send({ budget: 99999 });
    expect(res.status).toBe(404); // looks like 404 rather than 403 to not reveal existence
  });
});

describe("DELETE /api/v1/trips/:id", () => {
  it("200 — owner can delete their trip", async () => {
    const create = await request(app)
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validTrip);
    const tripId = create.body.data._id;

    const res = await request(app)
      .delete(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    // Confirm it's actually gone
    const check = await request(app)
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(check.status).toBe(404);
  });
});
