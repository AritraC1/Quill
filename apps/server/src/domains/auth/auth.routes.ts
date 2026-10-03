import express from "express";
import AuthController from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const router = express.Router();
const authController = new AuthController();

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

export default router;
