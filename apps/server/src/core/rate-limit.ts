import rateLimit from "express-rate-limit";

// General API cap — plenty for real browsing, stops abusive clients
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, slow down" },
});

// Auth flows (OTP request / verify / sign-up) — makes OTP and account
// enumeration attacks impractical. Only failed attempts count, so a user
// requesting then verifying normally never feels the limit.
export const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many attempts. Try again in a few minutes.",
  },
});
