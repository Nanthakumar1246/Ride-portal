import { Router } from "express";
import { listMyNotifications, markRead, markAllRead } from "../controllers/appNotifications.controller.js";

const router = Router();
router.get("/", listMyNotifications);
router.post("/:id/read", markRead);
router.post("/read-all", markAllRead);

export default router;
