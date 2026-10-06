
import { Router } from "express";
import {
  listActions,
  getAction,
  createActionHandler,
  updateActionHandler,
  deleteActionsHandler,
  bulkUploadActionsHandler,
} from "../controllers/actions.controller.js";
import { createUpload } from "../config/multer.config.js";

const upload = createUpload("actions");
const router = Router();

router.get("/", listActions);
router.get("/:id", getAction);
router.post("/", createActionHandler);
router.put("/:id", upload.single("attachment"), updateActionHandler);
router.post("/bulk", bulkUploadActionsHandler);
router.post("/delete-multiple", deleteActionsHandler);

export default router;
