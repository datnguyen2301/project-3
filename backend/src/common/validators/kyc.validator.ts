import Joi from 'joi';

export const submitKYCSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required',
  }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'any.required': 'Date of birth is required',
  }),
  nationality: Joi.string().max(50).optional().messages({
    'string.max': 'Nationality cannot exceed 50 characters',
  }),
  // Support both field names for document type
  documentType: Joi.string().valid('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'passport', 'national_id', 'drivers_license').optional().messages({
    'any.only': 'Document type must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE',
  }),
  idType: Joi.string().valid('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'passport', 'national_id', 'drivers_license').optional().messages({
    'any.only': 'ID type must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE',
  }),
  // Support both field names for document number
  documentNumber: Joi.string().min(5).max(50).optional().messages({
    'string.min': 'Document number must be at least 5 characters',
  }),
  idNumber: Joi.string().min(5).max(50).optional().messages({
    'string.min': 'ID number must be at least 5 characters',
  }),
  documentExpiry: Joi.date().optional().messages({
    'date.min': 'Document has expired',
  }),
  address: Joi.string().min(5).max(200).required().messages({
    'string.min': 'Address must be at least 5 characters',
    'any.required': 'Address is required',
  }),
  city: Joi.string().min(2).max(50).required(),
  postalCode: Joi.string().min(2).max(20).required(),
  country: Joi.string().max(50).required(),
  phoneNumber: Joi.string().max(20).optional(),
});
