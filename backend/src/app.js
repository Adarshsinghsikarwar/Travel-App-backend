import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";
import sanitizeInputs from "./middlewares/sanitize.middleware.js";
import passport from "./config/passport.js";
import morgan from "morgan";

import routes from "./routes/index.js";
import { razorpayWebhook } from "./controllers/webhook.controller.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";
import { clientUrl } from "./config/env.js";

const app = express();

app.use(helmet()); // sensible security headers (HSTS, no-sniff, frame deny, etc.)
app.disable("x-powered-by");
app.use(morgan("dev"));

app.use(cors({ origin: clientUrl, credentials: true }));

// IMPORTANT: Razorpay webhook signature must be verified against the RAW request
// body bytes. This route is registered with express.raw() BEFORE express.json()
// runs globally, so the handler sees the untouched buffer.
app.post(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);

app.use(express.json({ limit: "1mb" })); // limit body size — basic DoS guard
app.use(cookieParser());
app.use(sanitizeInputs); // strips $-prefixed/dotted keys in place — blocks NoSQL injection
app.use(hpp()); // protects against HTTP parameter pollution (e.g. ?role=admin&role=user)
app.use(passport.initialize());

app.use(generalLimiter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/v1", routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorMiddleware); // must be last

export default app;
