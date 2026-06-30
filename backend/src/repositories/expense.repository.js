import Expense from "../models/expense.model.js";

class ExpenseRepository {
  create(data) {
    return Expense.create(data);
  }

  findByTrip(tripId) {
    return Expense.find({ trip: tripId }).sort({ spentAt: -1 });
  }

  findOneAndDelete(id, userId) {
    return Expense.findOneAndDelete({ _id: id, user: userId });
  }

  aggregate(pipeline) {
    return Expense.aggregate(pipeline);
  }
}

export default new ExpenseRepository();
