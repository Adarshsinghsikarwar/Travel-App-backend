import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "booking_request",
        "booking_confirmed",
        "booking_cancelled",
        "payment_success",
        "review_received",
        "message",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // e.g. bookingId
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
