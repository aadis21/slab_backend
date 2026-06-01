import { Router } from 'express';
import {
  getDashboardStats,
  updateProfile,
  updateProfileSchema,
  adminGetAllUsers,
  adminGetUserById,
  adminAddWallet,
  adminAddWalletSchema,
  adminToggleUserStatus,
  adminGetStats,
  adminCreateUser,
  adminCreateUserSchema,
  adminUpdateUser,
  adminUpdateUserSchema,
  adminDeleteUser,
} from '../controllers/user.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// Protect all routes below
router.use(protect);

// ─── User Profile & Dashboard ────────────────────────────────────────────────
router.get('/dashboard', getDashboardStats);
router.patch('/profile', validate(updateProfileSchema), updateProfile);

// ─── Admin Users & Dashboard Routes ──────────────────────────────────────────
router.get('/admin/stats', adminOnly, adminGetStats);
router.get('/admin/users', adminOnly, adminGetAllUsers);
router.post('/admin/users', adminOnly, validate(adminCreateUserSchema), adminCreateUser);
router.get('/admin/users/:id', adminOnly, adminGetUserById);
router.patch('/admin/users/:id', adminOnly, validate(adminUpdateUserSchema), adminUpdateUser);
router.delete('/admin/users/:id', adminOnly, adminDeleteUser);
router.post('/admin/users/:id/wallet', adminOnly, validate(adminAddWalletSchema), adminAddWallet);
router.patch('/admin/users/:id/toggle-status', adminOnly, adminToggleUserStatus);

export default router;
