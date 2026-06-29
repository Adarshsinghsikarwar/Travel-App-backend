import reviewRepository from "../repositories/review.repository.js";
import tripRepository from "../repositories/trip.repository.js";

// // Admin-facing analytics. This is where $facet earns its keep: several
// independent stats computed in a single DB round trip.
class AnalyticsService {
  getAdminDashboard() {
    return tripRepo.aggregate([
      {
        $facet: {
          tripsByStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          topDestinations: [
            { $group: { _id: "$destination", tripCount: { $sum: 1 } } },
            { $sort: { tripCount: -1 } },
            { $limit: 5 },
          ],
          monthlyBudgetVolume: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                totalBudget: { $sum: "$budget" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
          totalTrips: [{ $count: "value" }],
        },
      },
    ]);
  }

  // Aggregation with $lookup: join reviews -> guide (user) info, get avg rating per guide
  getTopRatedGuides() {
    return reviewRepo.aggregate([
      { $match: { guide: { $ne: null } } },
      {
        $group: {
          _id: "$guide",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $sort: { avgRating: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "guideInfo",
        },
      },
      { $unwind: "$guideInfo" },
      {
        $project: {
          avgRating: 1,
          reviewCount: 1,
          "guideInfo.name": 1,
          "guideInfo.email": 1,
        },
      },
    ]);
  }
}

export default new AnalyticsService();
