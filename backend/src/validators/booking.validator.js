import { body } from "express-validator";

const createBookingValidator = [
  body("provider").isMongoId().withMessage("Valid provider id required"),
  body("startDate").isISO8601().withMessage("Valid startDate required"),
  body("endDate").isISO8601().withMessage("Valid endDate required"),
  body("trip").optional().isMongoId(),
];

export { createBookingValidator };
