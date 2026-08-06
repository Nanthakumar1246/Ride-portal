import { Router } from "express";
import { getModuleHistoryHandler } from "../controllers/moduleHistory.controller.js";

const router = Router();
router.get("/", getModuleHistoryHandler);

export default router;
