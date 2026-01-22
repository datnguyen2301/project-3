import Joi from 'joi';

// Extended order schema with advanced types
export const createAdvancedOrderSchema = Joi.object({
  symbol: Joi.string().required().messages({
    'any.required': 'Trading symbol is required',
  }),
  side: Joi.string().valid('BUY', 'SELL').required().messages({
    'any.only': 'Side must be BUY or SELL',
    'any.required': 'Order side is required',
  }),
  type: Joi.string()
    .valid('LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT', 'TRAILING_STOP')
    .required()
    .messages({
      'any.only': 'Invalid order type',
      'any.required': 'Order type is required',
    }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Amount must be positive',
    'any.required': 'Amount is required',
  }),
  price: Joi.number().positive().when('type', {
    is: Joi.string().valid('LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  stopPrice: Joi.number().positive().when('type', {
    is: Joi.string().valid('STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT', 'TRAILING_STOP'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  trailingDelta: Joi.number().positive().when('type', {
    is: 'TRAILING_STOP',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }).messages({
    'any.required': 'Trailing delta is required for trailing stop orders',
    'number.positive': 'Trailing delta must be positive',
  }),
  timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK').default('GTC'),
});

// OCO (One-Cancels-Other) Order
export const createOCOOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  side: Joi.string().valid('BUY', 'SELL').required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().required(), // Limit price
  stopPrice: Joi.number().positive().required(), // Stop price
  stopLimitPrice: Joi.number().positive().optional(), // Stop limit price (optional)
  timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK').default('GTC'),
});
