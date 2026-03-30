import express from "express";
import {
  login,
  logout,
  register,
  updateProfile,
  getAllUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import { singleUpload } from "../middlewares/mutler.js";

const router = express.Router();

// Public routes
router.route("/register").post(singleUpload, register);
router.route("/login").post(login);
router.route("/logout").get(logout);

// Protected routes - any authenticated user can update their own profile
router
  .route("/profile/update")
  .post(isAuthenticated, singleUpload, updateProfile);

// Admin only routes - user management
router.route("/").get(isAuthenticated, roleAuth("admin"), getAllUsers);
router
  .route("/:id/role")
  .put(isAuthenticated, roleAuth("admin"), updateUserRole);
router.route("/:id").delete(isAuthenticated, roleAuth("admin"), deleteUser);

export default router;
