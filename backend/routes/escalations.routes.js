import { Router } from "express";
import {
  listEscalations,
  getEscalation,
  createEscalationHandler,
  updateEscalationHandler,
  decideEscalationResolution,
  resolveEscalation,
  deleteEscalationsHandler,
} from "../controllers/escalations.controller.js";
import upload from "../config/multer.config.js";

const router = Router();
router.get("/", listEscalations);
router.get("/:id", getEscalation);
router.post("/", createEscalationHandler);
router.put("/:id", updateEscalationHandler);
router.post("/decisions/:notificationId", decideEscalationResolution);
router.post("/:id/resolve", upload.array("documents", 3), resolveEscalation);
router.post("/delete-multiple", deleteEscalationsHandler);

export default router;
