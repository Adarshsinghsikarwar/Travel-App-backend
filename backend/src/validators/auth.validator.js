import { body } from "express-validator";

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 }),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/\d/)
    .withMessage("Password must contain a number")
    .matches(/[A-Za-z]/)
    .withMessage("Password must contain a letter"),
];

const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const verifyOtpValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("6-digit OTP is required")
    .isNumeric()
    .withMessage("OTP must be numeric"),
];

const resendOtpValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

export {
  registerValidator,
  loginValidator,
  verifyOtpValidator,
  resendOtpValidator,
};
