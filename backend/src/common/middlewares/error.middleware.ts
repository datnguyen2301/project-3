import { Request, Response, NextFunction } from 'express';
import { errorResponse, AppError } from '../utils/response.utils';
import logger from '../../config/logger';

export const errorHandler = (err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return errorResponse(res, err.code, err.message, err.statusCode, err.details);
  }

  if (err.name === 'ValidationError') {
    return errorResponse(res, 'GEN_001', 'Validation error', 400, (err as any).details);
  }

  if ((err as any).code === 'P2002') {
    // Prisma unique constraint error
    return errorResponse(res, 'GEN_001', 'Duplicate entry', 400);
  }

  if ((err as any).code === 'P2025') {
    // Prisma record not found
    return errorResponse(res, 'GEN_002', 'Resource not found', 404);
  }

  // Default error
  return errorResponse(
    res,
    'GEN_004',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500
  );
};

export const notFoundHandler = (req: Request, res: Response) => {
  return errorResponse(res, 'GEN_002', `Route ${req.path} not found`, 404);
};
