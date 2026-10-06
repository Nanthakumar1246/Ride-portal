import { Router } from "express";
import {
  listRisks,
  getRisk,
  createRiskHandler,
  updateRiskHandler,
  deleteRisksHandler,
  decideRiskResolution,
  getRiskHistoryHandler,
} from "../controllers/risks.controller.js";
import { createUpload } from "../config/multer.config.js";

const upload = createUpload("risks");
const router = Router();

router.get("/", listRisks);
router.get("/:id/history", getRiskHistoryHandler);
router.get("/:id", getRisk);
router.post("/", createRiskHandler);
router.put("/:id", upload.single("attachment"), updateRiskHandler);
router.post("/delete-multiple", deleteRisksHandler);


router.post("/decisions/:notificationId", decideRiskResolution);

export default router;
