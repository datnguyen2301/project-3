import { Router, Request, Response, NextFunction } from 'express';
import { KYCController } from './kyc.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { submitKYCSchema } from '../../common/validators/kyc.validator';
import { upload } from '../../common/middlewares/upload.middleware';

const router = Router();
const kycController = new KYCController();

// All routes require authentication
router.use(authenticate);

// Get KYC status
router.get('/status', (req: Request, res: Response, next: NextFunction) => 
  kycController.getKYCStatus(req, res).catch(next)
);

// Submit KYC application
router.post('/submit', validate(submitKYCSchema), (req: Request, res: Response, next: NextFunction) =>
  kycController.submitKYC(req, res).catch(next)
);

// Upload KYC documents
router.post(
  '/upload-document',
  upload.fields([
    { name: 'frontDocument', maxCount: 1 },
    { name: 'backDocument', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  (req: Request, res: Response, next: NextFunction) => 
    kycController.uploadDocuments(req, res).catch(next)
);

// Get KYC application details
router.get('/application', (req: Request, res: Response, next: NextFunction) =>
  kycController.getApplication(req, res).catch(next)
);

export default router;
