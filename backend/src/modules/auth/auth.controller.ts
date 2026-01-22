import { Request, Response } from 'express';
import prisma from '../../config/database';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/auth.utils';
import { generateToken } from '../../common/utils/helpers';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { TwoFactorService } from './twoFactor.service';
import crypto from 'crypto';
import emailService from '../../common/services/email.service';

export class AuthController {
  private twoFactorService: TwoFactorService;

  constructor() {
    this.twoFactorService = new TwoFactorService();
  }

  // Register new user
  async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError('AUTH_001', 'Email already registered', 400);
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isVerified: true,
          createdAt: true,
        },
      });

      // Create user preference
      await prisma.userPreference.create({
        data: { userId: user.id },
      });

      // Generate verification token
      const verificationToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: verificationToken,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      // Send verification email (non-blocking)
      emailService.sendVerificationEmail(email, verificationToken)
        .then(() => logger.info(`Verification email sent to ${email}`))
        .catch((err) => logger.warn(`Failed to send verification email to ${email}:`, err.message));

      // Generate tokens
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id, user.email);

      // Save refresh token
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: refreshExpiresAt,
        },
      });

      // Log security event
      await prisma.securityLog.create({
        data: {
          userId: user.id,
          action: 'register',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      return successResponse(
        res,
        {
          user,
          accessToken,
          refreshToken,
        },
        201
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Register error:', error);
      throw new AppError('GEN_004', 'Registration failed', 500);
    }
  }

  // Login
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          isVerified: true,
          isActive: true,
          kycStatus: true,
          role: true,
        },
      });

      if (!user) {
        throw new AppError('AUTH_001', 'Invalid credentials', 401);
      }

      // Check if account is active
      if (!user.isActive) {
        throw new AppError('AUTH_004', 'Account suspended', 403);
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        // Log failed attempt
        await prisma.securityLog.create({
          data: {
            userId: user.id,
            action: 'login',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            status: 'failed',
          },
        });
        throw new AppError('AUTH_001', 'Invalid credentials', 401);
      }

      // Generate tokens
      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id, user.email);

      // Save refresh token
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: refreshExpiresAt,
        },
      });

      // Log successful login
      await prisma.securityLog.create({
        data: {
          userId: user.id,
          action: 'login',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      const { passwordHash, ...userWithoutPassword } = user; // eslint-disable-line @typescript-eslint/no-unused-vars

      return successResponse(res, {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Login error:', error);
      throw new AppError('GEN_004', 'Login failed', 500);
    }
  }

  // Refresh token
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      // Verify token
      verifyRefreshToken(refreshToken); // Throws if invalid

      // Check if token exists in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        throw new AppError('AUTH_002', 'Invalid refresh token', 401);
      }

      if (new Date() > storedToken.expiresAt) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new AppError('AUTH_002', 'Refresh token expired', 401);
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(storedToken.user.id, storedToken.user.email);
      const newRefreshToken = generateRefreshToken(storedToken.user.id, storedToken.user.email);

      // Delete old refresh token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });

      // Save new refresh token
      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          token: newRefreshToken,
          expiresAt: refreshExpiresAt,
        },
      });

      return successResponse(res, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Refresh token error:', error);
      throw new AppError('AUTH_002', 'Token refresh failed', 401);
    }
  }

  // Logout
  async logout(req: AuthRequest, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await prisma.refreshToken.deleteMany({
          where: {
            token: refreshToken,
            userId: req.user?.userId,
          },
        });
      }

      if (req.user) {
        await prisma.securityLog.create({
          data: {
            userId: req.user.userId,
            action: 'logout',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            status: 'success',
          },
        });
      }

      return successResponse(res, { message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      throw new AppError('GEN_004', 'Logout failed', 500);
    }
  }

  // Verify email
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;

      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
      });

      if (!verificationToken) {
        throw new AppError('AUTH_002', 'Invalid verification token', 400);
      }

      if (verificationToken.used) {
        throw new AppError('AUTH_002', 'Token already used', 400);
      }

      if (new Date() > verificationToken.expiresAt) {
        throw new AppError('AUTH_002', 'Token expired', 400);
      }

      // Update user
      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: { isVerified: true },
      });

      // Mark token as used
      await prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      });

      return successResponse(res, { message: 'Email verified successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Verify email error:', error);
      throw new AppError('GEN_004', 'Email verification failed', 500);
    }
  }

  // Resend verification email
  async resendVerification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('AUTH_001', 'Authentication required', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('AUTH_001', 'User not found', 404);
      }

      if (user.isVerified) {
        throw new AppError('AUTH_003', 'Email already verified', 400);
      }

      // Delete old tokens
      await prisma.verificationToken.deleteMany({
        where: {
          userId,
          type: 'EMAIL_VERIFICATION',
        },
      });

      // Generate new token
      const verificationToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.verificationToken.create({
        data: {
          userId,
          token: verificationToken,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      // Send verification email (non-blocking)
      emailService.sendVerificationEmail(user.email, verificationToken)
        .then(() => logger.info(`Verification email resent to ${user.email}`))
        .catch((err) => logger.warn(`Failed to resend verification email:`, err.message));

      return successResponse(res, { message: 'Verification email sent' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Resend verification error:', error);
      throw new AppError('GEN_004', 'Failed to resend verification', 500);
    }
  }

  // Forgot password
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Don't reveal if user exists
        return successResponse(res, {
          message: 'If email exists, password reset link has been sent',
        });
      }

      // Generate reset token
      const resetToken = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          type: 'PASSWORD_RESET',
          expiresAt,
        },
      });

      // Send password reset email
      await emailService.sendPasswordResetEmail(email, resetToken);
      logger.info(`Password reset email sent to ${email}`);

      return successResponse(res, {
        message: 'If email exists, password reset link has been sent',
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      throw new AppError('GEN_004', 'Failed to process request', 500);
    }
  }

  // Reset password
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;

      const resetToken = await prisma.verificationToken.findUnique({
        where: { token },
      });

      if (!resetToken || resetToken.type !== 'PASSWORD_RESET') {
        throw new AppError('AUTH_002', 'Invalid reset token', 400);
      }

      if (resetToken.used) {
        throw new AppError('AUTH_002', 'Token already used', 400);
      }

      if (new Date() > resetToken.expiresAt) {
        throw new AppError('AUTH_002', 'Token expired', 400);
      }

      // Hash new password
      const passwordHash = await hashPassword(password);

      // Update user password
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      // Mark token as used
      await prisma.verificationToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });

      // Delete all refresh tokens (logout all devices)
      await prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      });

      // Log security event
      await prisma.securityLog.create({
        data: {
          userId: resetToken.userId,
          action: 'password_reset',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      return successResponse(res, { message: 'Password reset successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Reset password error:', error);
      throw new AppError('GEN_004', 'Password reset failed', 500);
    }
  }

  // Change password
  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('AUTH_001', 'Authentication required', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('AUTH_001', 'User not found', 404);
      }

      // Verify current password
      const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('AUTH_001', 'Current password is incorrect', 400);
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Delete all refresh tokens except current (logout other devices)
      // In production, you might want to keep current session

      // Log security event
      await prisma.securityLog.create({
        data: {
          userId,
          action: 'password_change',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      return successResponse(res, { message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Change password error:', error);
      throw new AppError('GEN_004', 'Password change failed', 500);
    }
  }

  // Get 2FA status
  async get2FAStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          twoFaEnabled: true,
          twoFaSecret: true,
        },
      });

      if (!user) {
        throw new AppError('AUTH_002', 'User not found', 404);
      }

      return successResponse(res, {
        enabled: user.twoFaEnabled,
        hasSecret: !!user.twoFaSecret, // Has secret but not verified yet
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get 2FA status error:', error);
      throw new AppError('GEN_004', 'Failed to get 2FA status', 500);
    }
  }

  // Setup 2FA
  async setup2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('AUTH_002', 'User not found', 404);
      }

      // Verify password for security
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('AUTH_001', 'Invalid password', 400);
      }

      // Check if 2FA already enabled - return status instead of error
      if (user.twoFaEnabled) {
        return successResponse(res, {
          alreadyEnabled: true,
          message: '2FA is already enabled for this account',
        });
      }

      // Generate secret and QR code
      const { secret, qrCode } = await this.twoFactorService.generateSecret(user.email);

      // Generate backup codes
      const backupCodes = this.twoFactorService.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map(code => 
        crypto.createHash('sha256').update(code).digest('hex')
      );

      // Store secret temporarily (will be enabled after verification)
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFaSecret: secret,
          twoFaBackupCodes: hashedBackupCodes,
        },
      });

      return successResponse(res, {
        qrCode,
        secret,
        backupCodes, // Show once, user must save them
        message: 'Scan QR code with authenticator app and verify with a token',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Setup 2FA error:', error);
      throw new AppError('GEN_004', '2FA setup failed', 500);
    }
  }

  // Verify and enable 2FA
  async verify2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { token, password } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.twoFaSecret) {
        throw new AppError('AUTH_002', 'Please setup 2FA first', 400);
      }

      // Verify password only if provided (optional extra security)
      if (password) {
        const isValidPassword = await comparePassword(password, user.passwordHash);
        if (!isValidPassword) {
          throw new AppError('AUTH_001', 'Invalid password', 400);
        }
      }

      // Verify 2FA token
      const isValid = this.twoFactorService.verifyToken(user.twoFaSecret, token);
      if (!isValid) {
        throw new AppError('AUTH_011', 'Invalid 2FA token', 400);
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: { twoFaEnabled: true },
      });

      // Log security event
      await prisma.securityLog.create({
        data: {
          userId,
          action: 'enable_2fa',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      return successResponse(res, { message: '2FA enabled successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Verify 2FA error:', error);
      throw new AppError('GEN_004', '2FA verification failed', 500);
    }
  }

  // Disable 2FA
  async disable2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { token, password } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.twoFaEnabled) {
        throw new AppError('AUTH_002', '2FA is not enabled', 400);
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError('AUTH_001', 'Invalid password', 400);
      }

      // Verify 2FA token only if provided
      if (token && user.twoFaSecret) {
        const isValid = this.twoFactorService.verifyToken(user.twoFaSecret, token);
        if (!isValid) {
          throw new AppError('AUTH_011', 'Invalid 2FA token', 400);
        }
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFaEnabled: false,
          twoFaSecret: null,
          twoFaBackupCodes: [],
        },
      });

      // Log security event
      await prisma.securityLog.create({
        data: {
          userId,
          action: 'disable_2fa',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'success',
        },
      });

      return successResponse(res, { message: '2FA disabled successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Disable 2FA error:', error);
      throw new AppError('GEN_004', '2FA disable failed', 500);
    }
  }
}
