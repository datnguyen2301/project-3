import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { AppError } from '../../common/utils/response.utils';
import logger from '../../config/logger';

export class TwoFactorService {
  /**
   * Generate 2FA secret and QR code for user
   */
  async generateSecret(email: string): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      name: `Crypto Exchange (${email})`,
      issuer: 'Crypto Exchange',
    });

    if (!secret.otpauth_url) {
      throw new AppError('AUTH_012', 'Failed to generate 2FA secret', 500);
    }

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    logger.info(`2FA secret generated for ${email}`);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  /**
   * Verify 2FA token
   */
  verifyToken(secret: string, token: string): boolean {
    // Debug: Log verification attempt
    logger.info(`Verifying 2FA token: ${token}, secret length: ${secret?.length}`);
    
    // Generate expected token for debugging
    const expectedToken = speakeasy.totp({
      secret,
      encoding: 'base32',
    });
    logger.info(`Expected token: ${expectedToken}, Received token: ${token}`);

    const result = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 4, // Increased window for clock drift (2 minutes tolerance)
    });
    
    logger.info(`2FA verification result: ${result}`);
    return result;
  }

  /**
   * Generate backup codes for 2FA recovery
   */
  generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
