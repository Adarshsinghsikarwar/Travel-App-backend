import tripRepo from "../repositories/trip.repository.js";
import ApiError from "../utils/apiError.js";

class TripService {
  createTrip(userId, payload) {
    if (new Date(payload.startDate) > new Date(payload.endDate)) {
      throw new ApiError(400, "Start date cannot be after end date");
    }
    return tripRepo.create({ ...payload, user: userId });
  }

  getMyTrips(userId, filters) {
    return tripRepo.findByUser(userId, filters);
  }

  async getTripById(id, userId) {
    const trip = await tripRepo.findById(id);
    if (!trip) throw new ApiError(404, "Trip not found");
    if (String(trip.user) !== String(userId))
      throw new ApiError(403, "Not your trip");
    return trip;
  }

  async updateTrip(id, userId, update) {
    const trip = await tripRepo.findOneAndUpdate(id, userId, update);
    if (!trip) throw new ApiError(404, "Trip not found or not yours");
    return trip;
  }

  async deleteTrip(id, userId) {
    const trip = await tripRepo.findOneAndDelete(id, userId);
    if (!trip) throw new ApiError(404, "Trip not found or not yours");
    return trip;
  }
}

export default new TripService();
