import { body } from "express-validator";
const createTripValidator = [
  body("title").trim().notEmpty().isLength({ max: 150 }),
  body("destination").trim().notEmpty(),
  body("startDate").isISO8601(),
  body("endDate").isISO8601(),
  body("budget").isFloat({ min: 0 }),
];

const aiDraftValidator = [
  body("notes")
    .trim()
    .notEmpty()
    .withMessage("notes is required")
    .isLength({ max: 500 }),
];

export { createTripValidator, aiDraftValidator };
