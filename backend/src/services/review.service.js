import reviewRepo from '../repositories/review.repository.js';
import bookingRepo from '../repositories/booking.repository.js';
import providerRepo from '../repositories/provider.repository.js';
import ApiError from '../utils/apiError.js';
import { chatCompletion, AINotConfiguredError } from '../utils/mistralClient.js';
import logger from '../utils/logger.js';

class ReviewService {
  async createReview(travelerId, { booking: bookingId, rating, comment }) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (String(booking.traveler) !== String(travelerId)) throw new ApiError(403, 'You do not have permission to review this booking');
    if (booking.status !== 'completed') {
      throw new ApiError(400, 'Can only review a completed booking');
    }

    const existing = await reviewRepo.findByBooking(bookingId);
    if (existing) throw new ApiError(409, 'You already reviewed this booking');

    const review = await reviewRepo.create({
      booking: bookingId,
      provider: booking.provider._id,
      traveler: travelerId,
      rating,
      comment,
    });

    const [stats] = await reviewRepo.aggregateProviderStats(booking.provider._id);
    await providerRepo.updateRatingStats(booking.provider._id, stats?.avgRating || rating, stats?.count || 1);

    return review;
  }

  getForProvider(providerId) {
    return reviewRepo.findByProvider(providerId);
  }

  // Nobody reads 50 reviews. One short AI summary of real comments is far
  // more useful — this only ever summarizes comments that actually exist,
  // never invents sentiment that isn't in the data.
  async summarizeForProvider(providerId) {
    const reviews = await reviewRepo.findByProvider(providerId);
    const withComments = reviews.filter((r) => r.comment?.trim());

    if (withComments.length < 3) {
      return { summary: null, reviewCount: reviews.length, reason: 'Not enough written reviews to summarize yet' };
    }

    const commentBlock = withComments
      .slice(0, 30) // cap input size — recent/first 30 is plenty for a useful summary
      .map((r) => `- (${r.rating}/5) ${r.comment}`)
      .join('\n');

    try {
      const data = await chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Summarize these traveler reviews of a service provider in 2-3 sentences. ' +
              'Mention genuine consistent themes only — do not invent praise or complaints not present in the reviews.',
          },
          { role: 'user', content: commentBlock },
        ],
        maxTokens: 200,
      });
      return {
        summary: data.choices[0].message.content,
        reviewCount: reviews.length,
      };
    } catch (err) {
      if (err instanceof AINotConfiguredError) {
        throw new ApiError(503, 'Review summarization is not configured on this server');
      }
      logger.error(`Review summarization failed: ${err.message}`);
      throw new ApiError(502, 'Could not generate review summary right now');
    }
  }
}

export default new ReviewService();