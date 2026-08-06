
import { Router } from "express";
import {
  listIssues,
  getIssue,
  createIssueHandler,
  updateIssueHandler,
  decideIssueResolution,
  deleteIssuesHandler,
} from "../controllers/issues.controller.js";

const router = Router();
router.get("/", listIssues);
router.get("/:id", getIssue);
router.post("/", createIssueHandler);
router.put("/:id", updateIssueHandler);
router.post("/decisions/:notificationId", decideIssueResolution);
router.post("/delete-multiple", deleteIssuesHandler);

export default router;
