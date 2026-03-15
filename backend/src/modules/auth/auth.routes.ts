// ============================================================
// AUTH ROUTES
// ============================================================
import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authController } from './auth.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

export const authRouter = Router();

authRouter.post(
  '/login',
  celebrate({
    [Segments.BODY]: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    }),
  }),
  authController.login,
);

authRouter.get('/me', authenticate, authController.getMe);

authRouter.post(
  '/change-password',
  authenticate,
  celebrate({
    [Segments.BODY]: Joi.object({
      currentPassword: Joi.string().required(),
      // Enforce strength at schema level too
      newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
        .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, and a number' }),
    }),
  }),
  authController.changePassword,
);
