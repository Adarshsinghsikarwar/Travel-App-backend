import Provider from "../models/provider.model.js";

class ProviderRepository {
  create(data) {
    return Provider.create(data);
  }

  findById(id) {
    return Provider.findById(id).populate("user", "name email avatarUrl");
  }

  findByUserId(userId) {
    return Provider.findOne({ user: userId });
  }

  findOneAndUpdate(id, userId, update) {
    return Provider.findOneAndUpdate({ _id: id, user: userId }, update, {
      new: true,
    });
  }

  async search({
    serviceType,
    city,
    minPrice,
    maxPrice,
    lng,
    lat,
    radiusKm,
    page = 1,
    limit = 20,
  }) {
    const filter = { verificationStatus: "verified", isActive: true };
    if (serviceType) filter.serviceType = serviceType;
    if (city) filter["location.city"] = new RegExp(`^${city}$`, "i");
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }

    if (lng && lat) {
      filter.location = {
        $near: {
          $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
          $maxDistance: (Number(radiusKm) || 25) * 1000,
        },
      };
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const [results, total] = await Promise.all([
      Provider.find(filter)
        .populate("user", "name avatarUrl")
        .skip(skip)
        .limit(limit),
      Provider.countDocuments(filter),
    ]);

    return {
      results,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  }

  updateRatingStats(providerId, avgRating, reviewCount) {
    return Provider.findByIdAndUpdate(providerId, { avgRating, reviewCount });
  }

  setVerificationStatus(id, status) {
    return Provider.findByIdAndUpdate(
      id,
      { verificationStatus: status },
      { new: true }
    );
  }

  findPendingVerification() {
    return Provider.find({ verificationStatus: "pending" }).populate(
      "user",
      "name email"
    );
  }
}

export default new ProviderRepository();
