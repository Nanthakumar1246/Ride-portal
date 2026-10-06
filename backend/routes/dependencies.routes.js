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
import { createUpload } from "../config/multer.config.js";

const upload = createUpload("dependencies");
const router = Router();


router.use(authMiddleware);

router.get("/", listDependencies);
router.get("/:id", getDependency);
router.post("/", createDependencyHandler);
router.put("/:id", upload.single("attachment"), updateDependencyHandler);
router.post("/decisions/:notificationId", decideDependencyResolution);
router.post("/delete-multiple", deleteDependenciesHandler);

export default router;
