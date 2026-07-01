import rateLimit from 'express-rate-limit';

// Generous global limit — just stops outright abuse/DoS.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Strict limit on auth endpoints — this is the real brute-force defense,
// independent of the per-account lockout in auth.service.js.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

export { generalLimiter, authLimiter };
export default { generalLimiter, authLimiter };