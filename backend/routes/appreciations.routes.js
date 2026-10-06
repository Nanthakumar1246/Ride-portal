import { Router } from "express";
import {
  listAppreciations,
  getAppreciation,
  createAppreciationHandler,
  updateAppreciationHandler,
  deleteAppreciationsHandler,
  uploadAppreciationAttachmentHandler,
  decideAppreciationHandler,
} from "../controllers/appreciations.controller.js";
import { createUpload } from "../config/multer.config.js";

const upload = createUpload("appreciations");
const router = Router();
router.get("/", listAppreciations);
router.get("/:id", getAppreciation);
router.post("/", createAppreciationHandler);
router.put("/:id", updateAppreciationHandler);
router.post("/delete-multiple", deleteAppreciationsHandler);
router.post("/:id/attachment", upload.single("attachment"), uploadAppreciationAttachmentHandler);
router.post("/:id/decide", decideAppreciationHandler);

export default router;