import winston from "winston";
import { nodeEnv } from "../config/env.js";

// Centralized logger so we never accidentally console.log sensitive request
// bodies in production, and so error logs have consistent structure.

const logger = winston.createLogger({
  level: nodeEnv === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
