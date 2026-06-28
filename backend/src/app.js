import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import hpp from "hpp";

import routes from "./routes/index.js";
import passport from "./config/passport.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { sanitizeInputs } from "./middlewares/sanitize.middleware.js";
import { clientUrl } from "./config/env.js";

const app = express();

app.use(helmet()); // sensible security headers (HSTS, no-sniff, frame deny, etc.)
app.disable("x-powered-by");

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" })); // limit body size — basic DoS guard
app.use(morgan("dev"));
app.use(cookieParser());
app.use(sanitizeInputs); // strips any keys starting with "$" or containing "." from req.body/query/params — blocks NoSQL injection
app.use(hpp()); // protects against HTTP parameter pollution (e.g. ?role=admin&role=user)
app.use(passport.initialize());

app.use(generalLimiter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use(errorMiddleware);

export default app;
