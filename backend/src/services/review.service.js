import reviewRepo from "../repositories/review.repository.js";
import bookingRepo from "../repositories/booking.repository.js";
import providerRepo from "../repositories/provider.repository.js";
import ApiError from "../utils/ApiError.js";

class ReviewService {
  async createReview(travelerId, { booking: bookingId, rating, comment }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, "Booking not found");
    if (String(booking.traveler) !== String(travelerId))
      throw new ApiError(403, "Not your booking");
    if (booking.status !== "completed") {
      throw new ApiError(400, "Can only review a completed booking");
    }

    const existing = await reviewRepo.findByBooking(bookingId);
    if (existing) throw new ApiError(409, "You already reviewed this booking");

    const review = await reviewRepo.create({
      booking: bookingId,
      provider: booking.provider._id,
      traveler: travelerId,
      rating,
      comment,
    });

    const [stats] = await reviewRepo.aggregateProviderStats(
      booking.provider._id
    );
    await providerRepo.updateRatingStats(
      booking.provider._id,
      stats?.avgRating || rating,
      stats?.count || 1
    );

    return review;
  }

  getForProvider(providerId) {
    return reviewRepo.findByProvider(providerId);
  }
}

export default new ReviewService();
