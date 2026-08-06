import { Router } from "express";
import { getLayout, saveLayout, deleteLayout } from "../controllers/layout.controller.js";
import { authMiddleware, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/:module", authMiddleware, getLayout);
router.post("/:module", authMiddleware, requireAdmin, saveLayout);
router.post("/:module/reset", authMiddleware, deleteLayout);

export default router;
