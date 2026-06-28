import Trip from "../models/trip.model.js";

class TripRepository {
  create(data) {
    return Trip.create(data);
  }

  findById(id) {
    return Trip.findById(id);
  }

  findByUser(userId, filters = {}) {
    return Trip.find({ user: userId, ...filters }).sort({ createdAt: -1 });
  }

  findOneAndUpdate(id, userId, update) {
    return Trip.findOneAndUpdate({ _id: id, user: userId }, update, {
      new: true,
    });
  }

  findOneAndDelete(id, userId) {
    return Trip.findOneAndDelete({ _id: id, user: userId });
  }

  // generic escape hatch for any aggregation pipeline the service builds
  aggregate(pipeline) {
    return Trip.aggregate(pipeline);
  }
}

export default new TripRepository();
