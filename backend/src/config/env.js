import dotenv from "dotenv/config";

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri : process.env.MONGO_URI,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  accessToken: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m"
  },
  refreshToken: {
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d"
  }
};
