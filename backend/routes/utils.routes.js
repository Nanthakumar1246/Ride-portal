import express from "express";
import { previewIdHandler, getEmailAuditLogsHandler } from "../controllers/utils.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/preview-id", authMiddleware, previewIdHandler);
router.get("/email-audit-log", authMiddleware, getEmailAuditLogsHandler);

export default router;
