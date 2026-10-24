import express from "express";
import AuthController from "./auth.controller";
import OnboardingController from "./onboarding.controller";
import { requireAuth } from "./auth.middleware";

const router = express.Router();
const authController = new AuthController();
const onboardingController = new OnboardingController();

// Sign-up
router.post("/sign-up", authController.createAccount);

// Request OTP
router.post("/request-otp", authController.requestOTP);

// Verify OTP
router.post("/verify-otp", authController.verifyOTP);

// Refresh Token
router.post("/refresh-token", authController.refreshToken);

// Logout
router.delete("/logout", requireAuth, authController.logout);

// Onboarding
router.post("/onboard", requireAuth, onboardingController.onboard);

export default router;
