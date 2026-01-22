import Joi from 'joi';

export const createOrderSchema = Joi.object({
  symbol: Joi.string().uppercase().required(),
  side: Joi.string().valid('BUY', 'SELL').required(),
  type: Joi.string().valid('LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LIMIT').required(),
  price: Joi.number().positive().when('type', {
    is: Joi.string().valid('LIMIT', 'STOP_LIMIT'),
    then: Joi.required(),
  }),
  amount: Joi.number().positive().required(),
  stopPrice: Joi.number().positive().when('type', {
    is: Joi.string().valid('STOP_LOSS', 'STOP_LIMIT'),
    then: Joi.required(),
  }),
});

export const getOrdersSchema = Joi.object({
  symbol: Joi.string().uppercase().optional(),
  status: Joi.string().valid('PENDING', 'OPEN', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const cancelOrderSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
});
