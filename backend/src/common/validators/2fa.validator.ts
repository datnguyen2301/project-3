import Joi from 'joi';

export const setup2FASchema = Joi.object({
  password: Joi.string().required().messages({
    'any.required': 'Password is required for security verification',
    'string.empty': 'Password cannot be empty',
  }),
});

export const verify2FASchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': '2FA token must be 6 digits',
    'string.pattern.base': '2FA token must contain only digits',
    'any.required': '2FA token is required',
  }),
  password: Joi.string().optional().messages({
    'string.empty': 'Password cannot be empty',
  }),
});

export const disable2FASchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).optional().messages({
    'string.length': '2FA token must be 6 digits',
    'string.pattern.base': '2FA token must contain only digits',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

export const login2FASchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': '2FA token must be 6 digits',
    'string.pattern.base': '2FA token must contain only digits',
  }),
});
