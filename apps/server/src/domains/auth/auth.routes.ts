import express from "express";
import AuthController from "./auth.controller";
import OnboardingController from "./onboarding.controller";
import { requireAuth } from "./auth.middleware";
import { authLimiter } from "../../core/rate-limit";

const router = express.Router();
const authController = new AuthController();
const onboardingController = new OnboardingController();

// Sign-up
router.post("/sign-up", authLimiter, authController.createAccount);

// Request OTP
router.post("/request-otp", authLimiter, authController.requestOTP);

// Verify OTP (issues httpOnly auth cookies)
router.post("/verify-otp", authLimiter, authController.verifyOTP);

// Refresh Token (rotates the pair; reads/sets httpOnly cookies)
router.post("/refresh-token", authController.refreshToken);

// Session (boot-time state restore from the refresh cookie)
router.get("/session", authController.session);

// Logout (revokes the session and clears cookies)
router.delete("/logout", authController.logout);

// Onboarding
router.post("/onboard", requireAuth, onboardingController.onboard);

export default router;
