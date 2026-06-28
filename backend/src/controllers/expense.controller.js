import expenseService from "../services/expense.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

const addExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.addExpense(req.userId, req.body);
  res.status(201).json(new ApiResponse(201, expense, "Expense added"));
});

const getTripExpenses = asyncHandler(async (req, res) => {
  const expenses = await expenseService.getTripExpenses(req.params.tripId);
  res
    .status(200)
    .json(new ApiResponse(200, expenses, "Trip expenses retrieved"));
});

const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const breakdown = await expenseService.getCategoryBreakdown(
    req.params.tripId
  );
  res
    .status(200)
    .json(new ApiResponse(200, breakdown, "Category breakdown retrieved"));
});

const getMonthlyTrend = asyncHandler(async (req, res) => {
  const trend = await expenseService.getMonthlyTrend(req.userId);
  res.status(200).json(new ApiResponse(200, trend, "Monthly trend retrieved"));
});

export { addExpense, getTripExpenses, getCategoryBreakdown, getMonthlyTrend };
