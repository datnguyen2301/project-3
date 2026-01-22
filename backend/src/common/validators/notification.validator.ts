import Joi from 'joi';

export const updateNotificationSettingsSchema = Joi.object({
  emailNotifications: Joi.boolean().optional(),
  pushNotifications: Joi.boolean().optional(),
  orderFilled: Joi.boolean().optional(),
  priceAlert: Joi.boolean().optional(),
  deposit: Joi.boolean().optional(),
  withdrawal: Joi.boolean().optional(),
  security: Joi.boolean().optional(),
  marketing: Joi.boolean().optional(),
});
