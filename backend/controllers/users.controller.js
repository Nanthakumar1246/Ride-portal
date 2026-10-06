
import bcrypt from "bcrypt";
import { listAllUsers, listAdminPmUsers, getAssignedProjects, assignProjects, findByEmail, createUser, deleteUserById } from "../models/users.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;
const ALLOWED_ADMIN_CREATABLE_ROLES = ["ADMIN", "PM"];

export async function createUserHandler(req, res) {
  try {
    const { name, email, role, password } = req.body;

    if (!name || !String(name).trim()) {
      return sendError(res, 400, "Name is required");
    }
    if (!email || !ARCHE_EMAIL_REGEX.test(String(email).trim())) {
      return sendError(res, 400, "A valid @arche.global email is required");
    }
    if (!ALLOWED_ADMIN_CREATABLE_ROLES.includes(String(role || "").toUpperCase())) {
      return sendError(res, 400, "Role must be ADMIN or PM");
    }
    if (!password || String(password).length < 8) {
      return sendError(res, 400, "Password must be at least 8 characters");
    }

    const emailLower = String(email).trim().toLowerCase();
    const existing = await findByEmail(emailLower);
    if (existing) {
      return sendError(res, 409, "A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await createUser({
      name: String(name).trim(),
      email: emailLower,
      password_hash: passwordHash,
      role: String(role).toUpperCase(),
    });

    res.status(201);
    return sendSuccess(res, created, "User created successfully");
  } catch (err) {
    console.error("Create user error", err);
    return sendError(res, 500, err.message || "Failed to create user");
  }
}

export async function getUsers(req, res) {
    try {
        const users = await listAllUsers();
        
        const usersWithProjects = await Promise.all(
            users.map(async (u) => {
                const projects = await getAssignedProjects(u.id);
                return { ...u, projects };
            })
        );
        return sendSuccess(res, usersWithProjects);
    } catch (err) {
        console.error("List users error", err);
        return sendError(res, 500, "Failed to list users");
    }
}

export async function getAdminPmUsers(req, res) {
  try {
    const users = await listAdminPmUsers();
    return sendSuccess(res, users);
  } catch (err) {
    console.error("List admin/PM users error", err);
    return sendError(res, 500, "Failed to list users");
  }
}

export async function deleteUserHandler(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return sendError(res, 400, "User id is required");
    }
    if (String(req.user?.id) === String(id)) {
      return sendError(res, 400, "You cannot delete your own account");
    }

    const deleted = await deleteUserById(id);
    if (!deleted) {
      return sendError(res, 404, "Admin/PM user not found");
    }
    return sendSuccess(res, deleted, "User deleted successfully");
  } catch (err) {
    console.error("Delete user error", err);
    return sendError(res, 500, err.message || "Failed to delete user");
  }
}

export async function updateUserProjects(req, res) {
    try {
        const { id } = req.params;
        const { projectIds } = req.body; 
        await assignProjects(id, projectIds);
        return sendSuccess(res, { message: "Projects assigned successfully" });
    } catch (err) {
        console.error("Assign projects error", err);
        return sendError(res, 500, "Failed to assign projects");
    }
}
