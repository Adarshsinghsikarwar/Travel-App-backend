import { body, query } from "express-validator";

const createProviderValidator = [
  body("serviceType")
    .trim()
    .notEmpty()
    .withMessage("Service type is required")
    .isIn(["guide", "driver", "homestay", "planner", "photographer", "other"])
    .withMessage("Invalid service type"),
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 150 })
    .withMessage("Title must be at most 150 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must be at most 2000 characters"),
  body("pricePerDay")
    .notEmpty()
    .withMessage("Price per day is required")
    .isNumeric()
    .withMessage("Price per day must be a number")
    .custom((val) => Number(val) >= 0)
    .withMessage("Price per day must be a non-negative number"),
  body("currency")
    .optional()
    .trim(),
  body("location.coordinates")
    .isArray({ min: 2, max: 2 })
    .withMessage("Coordinates must be an array of [longitude, latitude]"),
  body("location.coordinates.*")
    .isNumeric()
    .withMessage("Coordinates must be numbers"),
  body("location.city")
    .optional()
    .trim(),
  body("location.address")
    .optional()
    .trim(),
];

const searchProviderValidator = [
  query("serviceType")
    .optional()
    .trim()
    .isIn(["guide", "driver", "homestay", "planner", "photographer", "other"])
    .withMessage("Invalid service type"),
  query("city")
    .optional()
    .trim(),
  query("minPrice")
    .optional()
    .isNumeric()
    .withMessage("minPrice must be a number")
    .custom((val) => Number(val) >= 0)
    .withMessage("minPrice must be non-negative"),
  query("maxPrice")
    .optional()
    .isNumeric()
    .withMessage("maxPrice must be a number")
    .custom((val) => Number(val) >= 0)
    .withMessage("maxPrice must be non-negative"),
  query("lng")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be a number between -180 and 180"),
  query("lat")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be a number between -90 and 90"),
  query("radiusKm")
    .optional()
    .isNumeric()
    .withMessage("Radius must be a number"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be an integer greater than or equal to 1"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be an integer greater than or equal to 1"),
];

export { createProviderValidator, searchProviderValidator };
