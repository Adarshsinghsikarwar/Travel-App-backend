import notificationRep from "../repositories/notification.repository.js";
import { brevo } from "../config/env.js";
import logger from "../config/logger.js";

// Sends one transactional email via Brevo's REST API. No SDK needed — it's a
// single HTTPS call, which is also easier to reason about than maintaining
// an SMTP connection (and side-steps cloud providers that throttle SMTP ports).
async function sendBrevoEmail({ to, subject, text }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevo.apiKey,
    },
    body: JSON.stringify({
      sender: { email: brevo.senderEmail, name: brevo.senderName },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Brevo API returned ${response.status}: ${errBody}`);
  }
}

class NotificationService {
  // Always create the in-app notification; email is best-effort and never
  // blocks or fails the calling request (booking/payment flow must not break
  // just because the email provider is down).
  async notify({ userId, type, title, body, relatedId, emailTo }) {
    const notification = await notificationRepo.create({
      user: userId,
      type,
      title,
      body,
      relatedId,
    });

    if (emailTo && brevo.apiKey) {
      sendBrevoEmail({ to: emailTo, subject: title, text: body }).catch((err) =>
        logger.error(`Brevo email send failed: ${err.message}`)
      );
    }

    return notification;
  }

  getForUser(userId, unreadOnly) {
    return notificationRepo.findByUser(userId, { unreadOnly });
  }

  markRead(id, userId) {
    return notificationRepo.markRead(id, userId);
  }
}

export default new NotificationService();
