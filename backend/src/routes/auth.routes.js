import express from 'express';
import passport from 'passport';
import { register, login, googleCallback, refresh, logout, verifyOtp, resendOtp , forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import requireAuth from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { registerValidator, loginValidator , verifyOtpValidator, resendOtpValidator , forgotPasswordValidator, resetPasswordValidator } from '../validators/auth.validator.js';

const router = express.Router();

router.post('/register', authLimiter, registerValidator, validate, register);
router.post('/login', authLimiter, loginValidator, validate, login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.post('/verify-otp', authLimiter, verifyOtpValidator, validate, verifyOtp);
router.post('/resend-otp', authLimiter, resendOtpValidator, validate, resendOtp);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, validate, resetPassword);


// Google OAuth — session: false because we issue our own JWTs, no server session needed
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/v1/auth/google/failure' }),
  googleCallback
);
router.get('/google/failure', (req, res) => res.status(401).json({ success: false, message: 'Google sign-in failed' }));

export default router;