import Review from "../models/review.model.js";

class ReviewRepository {
  create(data) {
    return Review.create(data);
  }

  findByBooking(bookingId) {
    return Review.findOne({ booking: bookingId });
  }

  aggregateProviderStats(providerId) {
    const mongoose = require("mongoose");
    return Review.aggregate([
      { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
      {
        $group: {
          _id: "$provider",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  findByProvider(providerId) {
    return Review.find({ provider: providerId })
      .populate("traveler", "name avatarUrl")
      .sort({ createdAt: -1 });
  }

  aggregate(pipeline) {
    return Review.aggregate(pipeline);
  }
}

export default new ReviewRepository();
