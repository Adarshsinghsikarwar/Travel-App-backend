import jwt from "jsonwebtoken";
import { accessToken, refreshToken } from "../config/env.js";

// Access token: short-lived, sent in response body, used as Bearer token
function generateAcessToken(userId) {
  return jwt.sign({ sub: userId }, accessToken, {
    expiresIn: accessToken.expiry,
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ sub: userId }, accessToken, {
    expiresIn: refreshToken.expiry,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, accessToken.secret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, refreshToken.secret);
}

export {
  generateAcessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
