import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../utils/validation';
import { userValidation } from '../../utils/validation';
import { authLimiter } from '../../middleware/rateLimiter';
import { protect } from '../../middleware/auth';
import Joi from 'joi';

const router = Router();
const authController = new AuthController();

// Validation schemas
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).required(),
});

const oauthSchema = Joi.object({
  token: Joi.string().required(),
});

const githubOauthSchema = Joi.object({
  code: Joi.string().required(),
});

// Public routes
router.post('/register', 
  authLimiter,
  validate(userValidation.register),
  authController.register
);

router.post('/login',
  authLimiter,
  validate(userValidation.login),
  authController.login
);

router.post('/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken
);

router.get('/verify-email/:token',
  authController.verifyEmail
);

router.post('/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.patch('/reset-password/:token',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// OAuth routes
router.post('/google',
  authLimiter,
  validate(oauthSchema),
  authController.googleAuth
);

router.post('/github',
  authLimiter,
  validate(githubOauthSchema),
  authController.githubAuth
);

// Protected routes
router.use(protect); // All routes after this middleware require authentication

router.post('/logout',
  authController.logout
);

router.post('/logout-all',
  authController.logoutAll
);

router.patch('/change-password',
  validate(userValidation.changePassword),
  authController.changePassword
);

router.get('/profile',
  authController.getProfile
);

export default router;