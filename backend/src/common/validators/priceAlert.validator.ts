import Joi from 'joi';

export const createPriceAlertSchema = Joi.object({
  symbol: Joi.string().required().messages({
    'any.required': 'Trading symbol is required',
  }),
  targetPrice: Joi.number().positive().required().messages({
    'number.positive': 'Target price must be positive',
    'any.required': 'Target price is required',
  }),
  condition: Joi.string().valid('ABOVE', 'BELOW').required().messages({
    'any.only': 'Condition must be ABOVE or BELOW',
    'any.required': 'Condition is required',
  }),
  note: Joi.string().max(200).optional(),
});
