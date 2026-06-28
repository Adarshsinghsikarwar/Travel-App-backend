import userModel from "../models/user.model.js";

class UserRepository {
  create(data) {
    return userModel.create(data);
  }
  findByEmail(email, withSensitive = false) {
    const query = userModel.findOne({ email });
    return withSensitive
      ? query.select(
          "+password +refreshTokenHash +failedLoginAttempts +lockUntil"
        )
      : query;
  }
  findById(id, withSensitive = false) {
    const query = userModel.findById(id);
    return withSensitive
      ? query.select("+refreshTokenHash +failedLoginAttempts +lockUntil")
      : query;
  }

  setRefreshTokenHash(userId, hash) {
    return userModel.findByIdAndUpdate(userId, { refreshTokenHash: hash });
  }

  clearRefreshTokenHash(userId) {
    return userModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }

  incrementFailedLogins(userId) {
    return userModel.findByIdAndUpdate(
      userId,
      { $inc: { failedLoginAttempts: 1 } },
      { new: true }
    ).select("+failedLoginAttempts +lockUntil");
  }

  lockAccount(userId, until) {
    return userModel.findByIdAndUpdate(userId, {
      lockUntil: until,
      failedLoginAttempts: 0,
    });
  }

  resetFailedLogins(userId) {
    return userModel.findByIdAndUpdate(userId, {
      failedLoginAttempts: 0,
      lockUntil: null,
    });
  }

  addRole(userId, role) {
    return userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { roles: role } },
      { new: true }
    );
  }
}

export default new UserRepository();
