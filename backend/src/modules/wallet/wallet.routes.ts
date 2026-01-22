import { Router, Request, Response, NextFunction } from 'express';
import { WalletController } from './wallet.controller';
import { authenticate, requireKYC } from '../../common/middlewares/auth.middleware';
import { validate, validateQuery } from '../../common/middlewares/validation.middleware';
import { withdrawSchema, getTransactionsSchema } from '../../common/validators/wallet.validator';

const router = Router();
const walletController = new WalletController();

// All routes require authentication
router.use(authenticate);

router.get('/balances', (req: Request, res: Response, next: NextFunction) => walletController.getBalances(req, res).catch(next));

router.get('/balance/:symbol', (req: Request, res: Response, next: NextFunction) =>
  walletController.getBalance(req, res).catch(next)
);

router.post('/withdraw', requireKYC(1), validate(withdrawSchema), (req: Request, res: Response, next: NextFunction) =>
  walletController.withdraw(req, res).catch(next)
);

router.get('/transactions', validateQuery(getTransactionsSchema), (req: Request, res: Response, next: NextFunction) =>
  walletController.getTransactions(req, res).catch(next)
);

// Support both /deposit-address/:symbol and /deposit-address?asset=BTC
router.get('/deposit-address/:symbol', (req: Request, res: Response, next: NextFunction) =>
  walletController.getDepositAddress(req, res).catch(next)
);

router.get('/deposit-address', (req: Request, res: Response, next: NextFunction) =>
  walletController.getDepositAddressQuery(req, res).catch(next)
);

export default router;
