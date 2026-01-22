import Joi from 'joi';

export const withdrawSchema = Joi.object({
  symbol: Joi.string().uppercase().required(),
  amount: Joi.number().positive().required(),
  address: Joi.string().required(),
  network: Joi.string().required(),
  memo: Joi.string().optional().allow(''),
});

export const getTransactionsSchema = Joi.object({
  type: Joi.string()
    .valid('DEPOSIT', 'WITHDRAW', 'TRADE', 'FEE', 'EARN_REWARD', 'FIAT_ORDER')
    .optional(),
  symbol: Joi.string().uppercase().optional(),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
