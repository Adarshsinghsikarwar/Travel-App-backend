import sanitizeHtml from "sanitize-html";
import messageRepo from "../repositories/message.repository.js";
import bookingRepo from "../repositories/booking.repository.js";
import ApiError from "../utils/apiError.js";

class MessageService {
  async send(senderId, bookingId, text) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, "Booking not found");

    const isParticipant =
      String(booking.traveler) === String(senderId) ||
      String(booking.provider.user._id || booking.provider.user) ===
        String(senderId);
    if (!isParticipant)
      throw new ApiError(403, "You are not part of this booking conversation");

    // Strip ALL HTML — chat is plain text only. Prevents stored XSS via chat messages.
    const clean = sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
    });
    if (!clean.trim()) throw new ApiError(400, "Message cannot be empty");

    return messageRepo.create({
      booking: bookingId,
      sender: senderId,
      text: clean,
    });
  }

  async getThread(bookingId, userId) {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) throw new ApiError(404, "Booking not found");

    const isParticipant =
      String(booking.traveler) === String(userId) ||
      String(booking.provider.user._id || booking.provider.user) ===
        String(userId);
    if (!isParticipant)
      throw new ApiError(403, "Not authorized to view this conversation");

    await messageRepo.markReadForUser(bookingId, userId);
    return messageRepo.findByBooking(bookingId);
  }
}

export default new MessageService();
