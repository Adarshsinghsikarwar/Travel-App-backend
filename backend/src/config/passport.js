import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { google } from "./env.js";
import crypto from "crypto";
import userRepository from "../repositories/user.repository.js";

// Google OAuth strategy. We never store the Google access token — we only
// use the profile to find-or-create our own user, then issue OUR OWN JWTs.
// This keeps auth uniform: every protected route only ever checks our JWT,
// regardless of whether the user signed up via password or Google.
passport.use(
  new GoogleStrategy(
    {
      clientID: google.clientId,
      clientSecret: google.clientSecret,
      callbackURL: google.callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        let user = await userRepository.findByEmail(email);

        if (!user) {
          user = await userRepository.create({
            name: profile.displayName,
            email,
            googleId: profile.id,

            // Random unusable password hash — this account can only log in via Google
            // unless the user later sets a password explicitly (a "link password" flow).
            password: crypto.randomBytes(32).toString("hex"),
            isEmailVerified: true,
            authProvider: "google",
          });
        } else if (!user.googleId) {
          // Existing email/password user logging in with Google for the first time — link it.
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;
