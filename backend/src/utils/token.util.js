import jwt from "jsonwebtoken";
import { accessToken, refreshToken } from "../config/env.js";


// Access token: short-lived, sent in response body, used as Bearer token
function generateAccessToken(userId) {
  return jwt.sign({ sub: userId }, accessToken.secret, {
    expiresIn: accessToken.expiry,
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ sub: userId }, refreshToken.secret, {
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
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
