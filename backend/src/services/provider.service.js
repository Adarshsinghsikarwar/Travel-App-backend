import providerRepo from "../repositories/provider.repository.js";
import ApiError from "../utils/apiError.js";
import userRepo from "../repositories/user.repository.js";

class ProviderService {
  async registerProvider(userId, payload) {
    const existing = await providerRepo.findByUserId(userId);
    if (existing)
      throw new ApiError(409, "You already have a provider profile");

    const provider = await providerRepo.create({ ...payload, user: userId });
    await userRepo.addRole(userId, "provider");
    return provider;
  }

  async getProvider(id) {
    const provider = await providerRepo.findById(id);
    if (!provider) throw new ApiError();
    return provider;
  }

  search(filters) {
    return providerRepo.search(filters);
  }

  async updateProvider(id, userId, update) {
    // Block self-service edits to trust-sensitive fields — only admin verification flow can change these.
    delete update.verificationStatus;
    delete update.avgRating;
    delete update.reviewCount;

    const provider = await providerRepo.findOneAndUpdate(id, userId, update);
    if (!provider) throw new ApiError(404, "Provider not found or not yours");
    return provider;
  }

  async addPhotos(id, userId, urls) {
    const provider = await providerRepo.findByUserId(userId);
    if (!provider || String(provider._id) !== String(id))
      throw new ApiError(403, "Not your provider profile");

    provider.photos.push(...urls);
    await provider.save();
    return provider;
  }

  // Admin-only
  setVerification(id, status) {
    return providerRepo.setVerificationStatus(id, status);
  }

  getPendingVerifications() {
    return providerRepo.findPendingVerification();
  }
}
export default new ProviderService();
