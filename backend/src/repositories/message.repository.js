import Message from "../models/message.model.js";

class MessageRepository {
  create(data) {
    return Message.create(data);
  }
  findByBooking(bookingId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    return Message.find({ booking: bookingId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  markReadForUser(bookingId, recipientUserId) {
    return Message.updateMany(
      { booking: bookingId, sender: { $ne: recipientUserId }, readAt: null },
      { readAt: new Date() }
    );
  }
}

export default new MessageRepository();
