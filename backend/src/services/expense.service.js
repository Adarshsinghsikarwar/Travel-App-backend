import expenseRepo from "../repositories/expense.repository.js";
import tripService from "./trip.service.js";
import mongoose from "mongoose";

class ExpenseService {
  async addExpense(userId, payload) {
    // verifies the trip belongs to this user before allowing an expense on it
    await tripService.getTripById(payload.trip, userId);
    return expenseRepo.create({ ...payload, user: userId });
  }

  getTripExpenses(tripId) {
    return expenseRepo.findByTrip(tripId);
  }

  // Aggregation: expense breakdown by category for one trip
  getCategoryBreakdown(tripId) {
    const mongoose = require("mongoose");
    return expenseRepo.aggregate([
      { $match: { trip: new mongoose.Types.ObjectId(tripId) } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  // Aggregation: this user's monthly spend trend across all trips
  getMonthlyTrend(userId) {
    const mongoose = require("mongoose");
    return expenseRepo.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { year: { $year: "$spentAt" }, month: { $month: "$spentAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  }
}
export default new ExpenseService();
