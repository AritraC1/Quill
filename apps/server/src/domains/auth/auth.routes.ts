import express from "express";
import AuthController from "./auth.controller";

const router = express.Router();
const authController = new AuthController();

// Sign-up
router.post("/sign-up", authController.createAccount);

// Request OTP
router.post("/request-otp", authController.requestOTP);

// Verify OTP
router.post("/verify-otp", authController.verifyOTP);

export default router;
