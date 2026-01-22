import { Router, Request, Response, NextFunction } from 'express';
import { UserController } from './users.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// Support both /me and /profile endpoints
router.get('/me', (req: Request, res: Response, next: NextFunction) => userController.getProfile(req, res).catch(next));
router.get('/profile', (req: Request, res: Response, next: NextFunction) => userController.getProfile(req, res).catch(next));

router.put('/me', (req: Request, res: Response, next: NextFunction) => userController.updateProfile(req, res).catch(next));

// Settings/Preferences endpoints
router.get('/me/preferences', (req: Request, res: Response, next: NextFunction) =>
  userController.getPreferences(req, res).catch(next)
);
router.get('/me/settings', (req: Request, res: Response, next: NextFunction) =>
  userController.getPreferences(req, res).catch(next)
);
router.put('/me/preferences', (req: Request, res: Response, next: NextFunction) =>
  userController.updatePreferences(req, res).catch(next)
);
router.put('/me/settings', (req: Request, res: Response, next: NextFunction) =>
  userController.updatePreferences(req, res).catch(next)
);
router.patch('/me/settings', (req: Request, res: Response, next: NextFunction) =>
  userController.updatePreferences(req, res).catch(next)
);

router.get('/me/security-logs', (req: Request, res: Response, next: NextFunction) =>
  userController.getSecurityLogs(req, res).catch(next)
);

router.delete('/me', (req: Request, res: Response, next: NextFunction) => userController.deleteAccount(req, res).catch(next));

export default router;
