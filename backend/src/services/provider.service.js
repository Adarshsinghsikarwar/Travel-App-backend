import providerRepo from '../repositories/provider.repository.js';
import userRepo from '../repositories/user.repository.js';
import ApiError from '../utils/apiError.js';
import { chatCompletion, AINotConfiguredError } from '../utils/mistralClient.js';
import logger from '../utils/logger.js';

const SEARCH_PARSE_PROMPT = `Extract structured search filters from a traveler's natural language
request for a local service provider. Respond with ONLY valid JSON, no markdown, matching this
shape (omit any field you can't confidently determine, don't guess):
{
  "city": "string or omit",
  "serviceType": "one of guide|driver|homestay|planner|photographer|other, or omit",
  "minPrice": "number or omit",
  "maxPrice": "number or omit"
}`;

class ProviderService {
  async registerProvider(userId, payload) {
    const existing = await providerRepo.findByUserId(userId);
    if (existing) throw new ApiError(409, 'You already have a provider profile');

    const provider = await providerRepo.create({ ...payload, user: userId });
    await userRepo.addRole(userId, 'provider');
    return provider;
  }

  async getProvider(id) {
    const provider = await providerRepo.findById(id);
    if (!provider) throw new ApiError(404, 'Provider not found');
    return provider;
  }

  search(filters) {
    return providerRepo.search(filters);
  }

  // "cheap guide in goa under 1500 for a family trip" -> { city, serviceType, maxPrice }
  // then runs that through the SAME search() above. The AI's only job here is
  // turning fuzzy language into the exact filter shape our search already understands.
  async smartSearch(naturalQuery, { page = 1, limit = 20 } = {}) {
    let filters;
    try {
      const data = await chatCompletion({
        messages: [
          { role: 'system', content: SEARCH_PARSE_PROMPT },
          { role: 'user', content: naturalQuery },
        ],
        responseFormat: { type: 'json_object' },
        maxTokens: 200,
      });
      filters = JSON.parse(data.choices[0].message.content);
    } catch (err) {
      if (err instanceof AINotConfiguredError) {
        throw new ApiError(503, 'Smart search is not configured on this server');
      }
      logger.error(`Smart search parsing failed: ${err.message}`);
      // Fail soft: fall back to an unfiltered search rather than erroring the whole request
      filters = {};
    }

    const result = await providerRepo.search({ ...filters, page, limit });
    return { ...result, interpretedFilters: filters };
  }

  async updateProvider(id, userId, update) {
    // Block self-service edits to trust-sensitive fields — only admin verification flow can change these.
    delete update.verificationStatus;
    delete update.avgRating;
    delete update.reviewCount;

    const provider = await providerRepo.findOneAndUpdate(id, userId, update);
    if (!provider) throw new ApiError(404, 'Provider profile not found or does not belong to you');
    return provider;
  }

  async addPhotos(id, userId, urls) {
    const provider = await providerRepo.findByUserId(userId);
    if (!provider || String(provider._id) !== String(id)) throw new ApiError(403, 'You do not have permission to modify this provider profile');

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