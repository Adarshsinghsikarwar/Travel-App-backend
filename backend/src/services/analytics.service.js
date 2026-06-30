import mongoose from "mongoose";
import bookingRepo from "../repositories/booking.repository.js";
import reviewRepo from "../repositories/review.repository.js";
import providerService from "./provider.service.js";

// Admin-facing analytics — $facet computes several independent metrics in one round trip.
class AnalyticsService {
  getAdminDashboard() {
    return bookingRepo.aggregate([
      {
        $facet: {
          bookingsByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          revenueByMonth: [
            { $match: { "payment.status": "paid" } },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                totalRevenue: { $sum: "$amount" },
                totalCommission: { $sum: "$commissionAmount" },
              },
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
          totalBookings: [{ $count: "value" }],
        },
      },
    ]);
  }

  getTopRatedProviders() {
    return reviewRepo.aggregate([
      {
        $group: {
          _id: "$provider",
          avgRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
      { $sort: { avgRating: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "providers",
          localField: "_id",
          foreignField: "_id",
          as: "providerInfo",
        },
      },
      { $unwind: "$providerInfo" },
      {
        $project: {
          avgRating: 1,
          reviewCount: 1,
          "providerInfo.title": 1,
          "providerInfo.serviceType": 1,
        },
      },
    ]);
  }

  getPendingProviderVerifications() {
    return providerService.getPendingVerifications();
  }
}

export default new AnalyticsService();
