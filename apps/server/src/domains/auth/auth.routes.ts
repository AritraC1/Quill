import express from "express";
import AuthController from "./auth.controller";

const router = express.Router();
const authController = new AuthController();

// Sign-up
router.post("/sign-up", authController.createAccount);

// Sign-in
// router.post("/sign-in", authController.login);

export default router;
