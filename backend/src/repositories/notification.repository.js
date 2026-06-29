import Notification from "../models/notification.model.js";

class NotificationRepository {
  create(data) {
    return Notification.create(data);
  }

  findByUser(userId, { unreadOnly = false } = {}) {
    const filter = { user: userId };
    if (unreadOnly) filter.readAt = null;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
  }

  markRead(id, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { readAt: new Date() }
    );
  }
}

export default new NotificationRepository();
