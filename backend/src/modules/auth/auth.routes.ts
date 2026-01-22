import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../common/middlewares/validation.middleware';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authLimiter } from '../../common/middlewares/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from '../../common/validators/auth.validator';
import { setup2FASchema, verify2FASchema, disable2FASchema } from '../../common/validators/2fa.validator';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.register(req, res).catch(next)
);

router.post('/login', authLimiter, validate(loginSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.login(req, res).catch(next)
);

router.post('/refresh-token', validate(refreshTokenSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.refreshToken(req, res).catch(next)
);

router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.forgotPassword(req, res).catch(next)
);

router.post('/reset-password', validate(resetPasswordSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.resetPassword(req, res).catch(next)
);

router.post('/verify-email', (req: Request, res: Response, next: NextFunction) =>
  authController.verifyEmail(req, res).catch(next)
);

// Protected routes
router.post('/logout', authenticate, (req: Request, res: Response, next: NextFunction) =>
  authController.logout(req, res).catch(next)
);

router.post('/resend-verification', authenticate, (req: Request, res: Response, next: NextFunction) =>
  authController.resendVerification(req, res).catch(next)
);

router.post('/change-password', authenticate, validate(changePasswordSchema), (req: Request, res: Response, next: NextFunction) =>
  authController.changePassword(req, res).catch(next)
);

// 2FA routes
router.get('/2fa/status', authenticate, (req: Request, res: Response, next: NextFunction) =>
  authController.get2FAStatus(req, res).catch(next)
);

router.post('/2fa/setup', authenticate, validate(setup2FASchema), (req: Request, res: Response, next: NextFunction) =>
  authController.setup2FA(req, res).catch(next)
);

router.post('/2fa/verify', authenticate, validate(verify2FASchema), (req: Request, res: Response, next: NextFunction) =>
  authController.verify2FA(req, res).catch(next)
);

router.post('/2fa/disable', authenticate, validate(disable2FASchema), (req: Request, res: Response, next: NextFunction) =>
  authController.disable2FA(req, res).catch(next)
);

export default router;
