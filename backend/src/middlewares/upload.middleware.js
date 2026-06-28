import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary-v2";
import { v2 as cloudinary } from "cloudinary";
import { cloudinary as cloudinaryConfig } from "../config/env.js";

cloudinary.config({
  cloud_name: cloudinaryConfig.cloudName,
  api_key: cloudinaryConfig.apiKey,
  api_secret: cloudinaryConfig.apiSecret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "tripConnect",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  },
});

/// Limits: max 5 files, 5MB each — prevents storage/bandwidth abuse via uploads.
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

export { upload };
