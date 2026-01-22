import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../../config';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, config.bcryptSaltRounds);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateAccessToken = (userId: string, email: string): string => {
  return jwt.sign(
    { userId, email, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiration } as SignOptions
  );
};

export const generateRefreshToken = (userId: string, email: string): string => {
  return jwt.sign(
    { userId, email, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiration } as SignOptions
  );
};

export const verifyAccessToken = (token: string): { userId: string; email: string; type?: string } => {
  try {
    return jwt.verify(token, config.jwt.secret) as { userId: string; email: string; type?: string };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): { userId: string; email: string; type?: string } => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as { userId: string; email: string; type?: string };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};
