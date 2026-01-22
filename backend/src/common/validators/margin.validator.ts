import Joi from 'joi';

export const borrowSchema = Joi.object({
  asset: Joi.string().required().messages({
    'any.required': 'Asset is required',
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Amount must be positive',
    'any.required': 'Amount is required',
  }),
});

export const repaySchema = Joi.object({
  asset: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

export const createMarginOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  side: Joi.string().valid('BUY', 'SELL').required(),
  type: Joi.string().valid('LIMIT', 'MARKET').required(),
  amount: Joi.number().positive().required(),
  price: Joi.number().positive().when('type', {
    is: 'LIMIT',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  leverage: Joi.number().min(1).max(10).default(1), // Max 10x leverage
});
