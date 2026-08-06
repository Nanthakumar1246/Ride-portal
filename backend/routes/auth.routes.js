import express from "express";
import { loginHandler, resetPasswordExpiredHandler, approveBMHandler, getApprovedBMsHandler, forgotPasswordOtpHandler, resetPasswordOtpHandler } from "../controllers/auth.controller.js";
import { requireAdmin, authMiddleware } from "../middleware/auth.middleware.js"; 

const router = express.Router();

router.post("/login", loginHandler);
router.post("/approve-bm", authMiddleware, requireAdmin, approveBMHandler); 
router.get("/approved-bms", authMiddleware, requireAdmin, getApprovedBMsHandler); 
router.post("/reset-password-expired", resetPasswordExpiredHandler);
router.post("/forgot-password-otp", forgotPasswordOtpHandler);
router.post("/reset-password-otp", resetPasswordOtpHandler);

export default router;
