import tripRepo from '../repositories/trip.repository.js';
import ApiError from '../utils/apiError.js';
import { chatCompletion, AINotConfiguredError } from '../utils/mistralClient.js';
import logger from '../utils/logger.js';

const DRAFT_PROMPT = `Turn a traveler's rough trip notes into a clean trip title and short
description. Respond with ONLY valid JSON, no markdown, matching this shape (omit a field
you can't confidently determine, don't invent specifics the notes don't support):
{
  "title": "short catchy trip title",
  "description": "1-2 sentence description",
  "destination": "string or omit",
  "suggestedBudget": "number in INR or omit"
}`;

class TripService {
  createTrip(userId, payload) {
    if (new Date(payload.startDate) > new Date(payload.endDate)) {
      throw new ApiError(400, 'Start date cannot be after end date');
    }
    return tripRepo.create({ ...payload, user: userId });
  }

  getMyTrips(userId, filters) {
    return tripRepo.findByUser(userId, filters);
  }

  async getTripById(id, userId) {
    const trip = await tripRepo.findById(id);
    if (!trip) throw new ApiError(404, 'Trip not found');
    if (String(trip.user) !== String(userId)) throw new ApiError(403, 'You do not have permission to access this trip');
    return trip;
  }

  async updateTrip(id, userId, update) {
    const trip = await tripRepo.findOneAndUpdate(id, userId, update);
    if (!trip) throw new ApiError(404, 'Trip not found or you do not have permission to modify it');
    return trip;
  }

  async deleteTrip(id, userId) {
    const trip = await tripRepo.findOneAndDelete(id, userId);
    if (!trip) throw new ApiError(404, 'Trip not found or you do not have permission to modify it');
    return trip;
  }

  // Doesn't save anything — just hands back a suggestion the client can show
  // pre-filled in the "create trip" form, which the traveler can edit before
  // actually calling createTrip(). The AI never writes to the DB directly.
  async generateDraft(notes) {
    try {
      const data = await chatCompletion({
        messages: [
          { role: 'system', content: DRAFT_PROMPT },
          { role: 'user', content: notes },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: 200,
      });
      return JSON.parse(data.choices[0].message.content);
    } catch (err) {
      if (err instanceof AINotConfiguredError) {
        throw new ApiError(503, 'AI trip draft generation is not configured on this server');
      }
      logger.error(`Trip draft generation failed: ${err.message}`);
      throw new ApiError(502, 'Could not generate a trip draft right now, please fill it in manually');
    }
  }
}

export default new TripService();