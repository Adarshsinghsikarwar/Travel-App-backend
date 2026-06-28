import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    serviceType: {
      type: String,
      enum: ["guide", "driver", "homestay", "planner", "photographer", "other"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000 },

    pricePerDay: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    photos: [{ type: String }], // Cloudinary URLs

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
      address: { type: String, trim: true },
      city: { type: String, trim: true, index: true },
    },

    availability: [
      {
        startDate: Date,
        endDate: Date,
      },
    ],

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verificationDocs: [{ type: String }], // Cloudinary URLs of ID/proof docs

    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

providerSchema.index({ location: "2dsphere" });
providerSchema.index({
  serviceType: 1,
  "location.city": 1,
  verificationStatus: 1,
});

export default mongoose.model("Provider", providerSchema);
