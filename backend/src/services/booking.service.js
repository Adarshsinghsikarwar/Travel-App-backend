import bookingRepo from '../repositories/booking.repository.js';
import providerRepo from '../repositories/provider.repository.js';
import userRepo from '../repositories/user.repository.js';
import paymentService from './payment.service.js';
import notificationService from './notification.service.js';
import ApiError from '../utils/apiError.js';
import { commissionPercent } from '../config/env.js';

const RESPOND_WINDOW_HOURS = 24;

class BookingService {
  async createBookingRequest(travelerId, { provider: providerId, startDate, endDate, trip }) {
    if (new Date(startDate) >= new Date(endDate)) {
      throw new ApiError(400, 'Start date must be before end date');
    }

    const provider = await providerRepo.findById(providerId);
    if (!provider || provider.verificationStatus !== 'verified' || !provider.isActive) {
      throw new ApiError(404, 'Provider not available for booking');
    }
    if (String(provider.user._id) === String(travelerId)) {
      throw new ApiError(400, 'You cannot book your own service');
    }

    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const amount = days * provider.pricePerDay;
    const commissionAmount = Math.round((amount * commissionPercent) / 100);
    const providerPayoutAmount = amount - commissionAmount;

    const booking = await bookingRepo.create({
      traveler: travelerId,
      provider: providerId,
      trip,
      startDate,
      endDate,
      amount,
      commissionAmount,
      providerPayoutAmount,
      respondBy: new Date(Date.now() + RESPOND_WINDOW_HOURS * 60 * 60 * 1000),
    });

    await notificationService.notify({
      userId: provider.user._id,
      type: 'booking_request',
      title: 'New booking request',
      body: `You have a new booking request for ${days} day(s).`,
      relatedId: booking._id,
    });

    return booking;
  }

  async respondToRequest(bookingId, providerUserId, decision) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (String(booking.provider.user._id || booking.provider.user) !== String(providerUserId)) {
      throw new ApiError(403, 'You do not have permission to respond to this booking');
    }
    if (booking.status !== 'requested') throw new ApiError(409, 'This booking is no longer pending');

    const newStatus = decision === 'accept' ? 'confirmed' : 'rejected';
    // Atomic — guards against a double-click or duplicate request racing this update.
    const updated = await bookingRepo.updateStatusIfCurrent(bookingId, 'requested', newStatus);
    if (!updated) throw new ApiError(409, 'Booking status changed concurrently, please retry');

    if (newStatus === 'confirmed') {
      const order = await paymentService.createOrder({
        amount: booking.amount,
        receipt: String(booking._id),
      });
      updated.payment.razorpayOrderId = order.id;
      await updated.save();
    }

    await notificationService.notify({
      userId: booking.traveler,
      type: newStatus === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled',
      title: newStatus === 'confirmed' ? 'Booking confirmed!' : 'Booking rejected',
      body:
        newStatus === 'confirmed'
          ? 'Your booking was accepted. Please complete payment to secure it.'
          : 'The provider was unable to accept your booking.',
      relatedId: booking._id,
    });

    return updated;
  }

  // Called after Razorpay checkout returns a signature on the client — verify
  // here BEFORE trusting it, but the webhook (payment.controller) is the
  // authoritative confirmation since it comes server-to-server from Razorpay.
  async verifyAndRecordPayment(bookingId, { orderId, paymentId, signature }) {
    paymentService.verifyCheckoutSignature({ orderId, paymentId, signature });

    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (booking.payment.razorpayOrderId !== orderId) throw new ApiError(400, 'Order mismatch');

    booking.payment.razorpayPaymentId = paymentId;
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    await booking.save();

    await notificationService.notify({
      userId: booking.traveler,
      type: 'payment_success',
      title: 'Payment received',
      body: `Your payment of ₹${booking.amount} was successful.`,
      relatedId: booking._id,
    });

    return booking;
  }

  // Idempotent: webhooks can be delivered more than once by design — calling
  // this twice for the same payment must not double-process anything.
  async handleWebhookPaymentCaptured(orderId, paymentId) {
    const booking = await bookingRepo.findByOrderId(orderId);
    if (!booking) return; // unknown order — log upstream, don't throw into the webhook response
    if (booking.payment.status === 'paid') return; // already processed

    booking.payment.razorpayPaymentId = paymentId;
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    await booking.save();
  }

  async cancelBooking(bookingId, userId, reason) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');

    const isTraveler = String(booking.traveler._id || booking.traveler) === String(userId);
    const isProvider = String(booking.provider.user._id || booking.provider.user) === String(userId);
    if (!isTraveler && !isProvider) throw new ApiError(403, 'Not authorized to cancel this booking');

    if (['completed', 'cancelled', 'rejected'].includes(booking.status)) {
      throw new ApiError(409, `Cannot cancel a booking that is already ${booking.status}`);
    }

    booking.status = 'cancelled';
    booking.cancellation = { cancelledBy: userId, reason, cancelledAt: new Date() };
    await booking.save();

    if (booking.payment.status === 'paid') {
      await paymentService.refund(booking.payment.razorpayPaymentId, booking.amount);
      booking.payment.status = 'refunded';
      await booking.save();
    }

    return booking;
  }

  async markCompleted(bookingId, providerUserId) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (String(booking.provider.user._id || booking.provider.user) !== String(providerUserId)) {
      throw new ApiError(403, 'You do not have permission to manage this booking');
    }
    const updated = await bookingRepo.updateStatusIfCurrent(bookingId, 'confirmed', 'completed');
    if (!updated) throw new ApiError(409, 'Booking must be confirmed before it can be completed');
    return updated;
  }

  getMyBookingsAsTraveler(userId) {
    return bookingRepo.findByTraveler(userId);
  }

  async getMyBookingsAsProvider(providerUserId) {
    const provider = await providerRepo.findByUserId(providerUserId);
    if (!provider) throw new ApiError(404, 'No provider profile found');
    return bookingRepo.findByProvider(provider._id);
  }
}

export default new BookingService();