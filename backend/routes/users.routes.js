
import { Router } from "express";
import { getUsers, getAdminPmUsers, updateUserProjects, createUserHandler, deleteUserHandler } from "../controllers/users.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", getUsers);
router.get("/admin-pm", requireAdmin, getAdminPmUsers);
router.post("/", requireAdmin, createUserHandler);
router.delete("/:id", requireAdmin, deleteUserHandler);
router.post("/:id/projects", updateUserProjects);

export default router;
