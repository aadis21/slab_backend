import { Router } from 'express';
import {
  register, registerSchema,
  login, loginSchema,
  sendOtpHandler, sendOtpSchema,
  verifyOtpHandler, verifyOtpSchema,
  logout,
  getMe,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/otp/send', validate(sendOtpSchema), sendOtpHandler);
router.post('/otp/verify', validate(verifyOtpSchema), verifyOtpHandler);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
