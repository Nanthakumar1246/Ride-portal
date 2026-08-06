
import { Router } from "express";
import {
  listActions,
  getAction,
  createActionHandler,
  updateActionHandler,
  deleteActionsHandler,
  bulkUploadActionsHandler,
} from "../controllers/actions.controller.js";

const router = Router();

router.get("/", listActions);
router.get("/:id", getAction);
router.post("/", createActionHandler);
router.put("/:id", updateActionHandler);
router.post("/bulk", bulkUploadActionsHandler);
router.post("/delete-multiple", deleteActionsHandler);

export default router;
