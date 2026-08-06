import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";

import {
  listDependencies,
  getDependency,
  createDependencyHandler,
  updateDependencyHandler,
  decideDependencyResolution,
  deleteDependenciesHandler,
} from "../controllers/dependencies.controller.js";

const router = Router();


router.use(authMiddleware);

router.get("/", listDependencies);
router.get("/:id", getDependency);
router.post("/", createDependencyHandler);
router.put("/:id", updateDependencyHandler);
router.post("/decisions/:notificationId", decideDependencyResolution);
router.post("/delete-multiple", deleteDependenciesHandler);

export default router;
