import mongoose from "mongoose";

import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 8 },

    // A user can be a traveler and a provider at the same time.
    roles: {
      type: [String],
      enum: ["traveler", "provider", "admin"],
      default: ["traveler"],
    },

    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, index: true, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    verificationOtp: { type: String, default: null, select: false },
    verificationOtpExpires: { type: Date, default: null, select: false },

    refreshTokenHash: { type: String, select: false, default: null },

    // Brute-force protection: lock the account after repeated failed logins.
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },

    isActive: { type: Boolean, default: true },
    avatarUrl: { type: String, default: null },
    phone: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

export default mongoose.model("User", userSchema);
