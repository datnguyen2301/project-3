import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/auth.utils';
import { errorResponse } from '../utils/response.utils';
import prisma from '../../config/database';

export type AuthRequest = Request & {
  userId?: string;
  email?: string;
  user?: {
    id: string;
    userId: string;
    email: string;
  };
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'AUTH_001', 'No token provided', 401);
    }

    const token = authHeader.substring(7);

    const decoded = verifyAccessToken(token);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, isActive: true, isVerified: true },
    });

    if (!user) {
      return errorResponse(res, 'AUTH_001', 'User not found', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'AUTH_004', 'Account suspended', 403);
    }

    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
    };

    return next();
  } catch (error) {
    return errorResponse(res, 'AUTH_002', 'Invalid or expired token', 401);
  }
};

export const requireVerified = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'AUTH_001', 'Authentication required', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isVerified: true },
    });

    if (!user?.isVerified) {
      return errorResponse(res, 'AUTH_003', 'Email verification required', 403);
    }

    return next();
  } catch (error) {
    next(error);
  }
};

export const requireKYC = (level: number = 1) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return errorResponse(res, 'AUTH_001', 'Authentication required', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { kycStatus: true },
      });

      if (user?.kycStatus !== 'APPROVED') {
        return errorResponse(res, 'KYC_001', `KYC level ${level} verification required`, 403);
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
};

// List of admin emails - should be moved to environment variables or database
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@cryptoexchange.com').split(',').map(e => e.trim());

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return errorResponse(res, 'AUTH_001', 'Authentication required', 401);
    }

    if (!ADMIN_EMAILS.includes(req.user.email)) {
      return errorResponse(res, 'AUTH_005', 'Admin access required', 403);
    }

    return next();
  } catch (error) {
    next(error);
  }
};
