
import { Router } from "express";
import {
  listIssues,
  getIssue,
  createIssueHandler,
  updateIssueHandler,
  decideIssueResolution,
  deleteIssuesHandler,
} from "../controllers/issues.controller.js";
import { createUpload } from "../config/multer.config.js";

const upload = createUpload("issues");
const router = Router();
router.get("/", listIssues);
router.get("/:id", getIssue);
router.post("/", createIssueHandler);
router.put("/:id", upload.single("attachment"), updateIssueHandler);
router.post("/decisions/:notificationId", decideIssueResolution);
router.post("/delete-multiple", deleteIssuesHandler);

export default router;
