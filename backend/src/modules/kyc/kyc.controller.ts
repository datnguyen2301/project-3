import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';

export class KYCController {
  // Get KYC status
  async getKYCStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true },
      });

      const application = await prisma.kycApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          rejectionReason: true,
          reviewedAt: true,
        },
      });

      return successResponse(res, {

        kycStatus: user?.kycStatus || 'NOT_SUBMITTED',
        application,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get KYC status error:', error);
      throw new AppError('GEN_004', 'Failed to get KYC status', 500);
    }
  }

  // Submit KYC application
  async submitKYC(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const {
        firstName,
        lastName,
        dateOfBirth,
        nationality,
        documentNumber,
        idNumber,
        documentType,
        idType,
        documentExpiry,
        address,
        city,
        postalCode,
        country,
        phoneNumber,
      } = req.body;

      // Support both field names
      const finalDocumentNumber = documentNumber || idNumber;
      const finalDocumentType = documentType || idType;

      // Check if already verified
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.kycStatus === 'APPROVED') {
        throw new AppError('KYC_001', 'KYC already verified', 400);
      }

      // Check for pending application - update if exists instead of blocking
      const pendingApp = await prisma.kycApplication.findFirst({
        where: {
          userId,
          status: 'PENDING',
        },
      });

      let application;
      
      if (pendingApp) {
        // Update existing pending application
        application = await prisma.kycApplication.update({
          where: { id: pendingApp.id },
          data: {
            firstName,
            lastName,
            dateOfBirth: new Date(dateOfBirth),
            nationality: nationality || country,
            documentNumber: finalDocumentNumber,
            documentType: finalDocumentType?.toUpperCase(),
            idType: finalDocumentType?.toUpperCase(),
            idNumber: finalDocumentNumber,
            documentExpiry: documentExpiry ? new Date(documentExpiry) : null,
            address: typeof address === 'string' ? address : JSON.stringify(address),
            city,
            postalCode,
            country,
            submittedAt: new Date(),
          },
        });
      } else {
        // Create new KYC application
        application = await prisma.kycApplication.create({
          data: {
            userId,
            firstName,
            lastName,
            dateOfBirth: new Date(dateOfBirth),
            nationality: nationality || country,
            documentNumber: finalDocumentNumber,
            documentType: finalDocumentType?.toUpperCase(),
            idType: finalDocumentType?.toUpperCase(),
            idNumber: finalDocumentNumber,
            documentExpiry: documentExpiry ? new Date(documentExpiry) : null,
            address: typeof address === 'string' ? address : JSON.stringify(address),
            city,
            postalCode,
            country,
            status: 'PENDING',
            submittedAt: new Date(),
          },
        });
      }

      // Update user KYC status
      await prisma.user.update({
        where: { id: userId },
        data: { kycStatus: 'PENDING' },
      });

      return successResponse(res, {
        message: 'KYC application submitted successfully',
        applicationId: application.id,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Submit KYC error:', error);
      throw new AppError('GEN_004', 'KYC submission failed', 500);
    }
  }

  // Upload KYC documents
  async uploadDocuments(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || Object.keys(files).length === 0) {
        throw new AppError('KYC_003', 'No documents uploaded', 400);
      }

      // Get pending KYC application
      const application = await prisma.kycApplication.findFirst({
        where: {
          userId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!application) {
        throw new AppError('KYC_004', 'No pending KYC application found', 404);
      }

      // Update application with document paths
      const updateData: any = {};

      if (files.frontDocument) {
        updateData.frontDocumentUrl = `/uploads/kyc/${files.frontDocument[0].filename}`;
      }
      if (files.backDocument) {
        updateData.backDocumentUrl = `/uploads/kyc/${files.backDocument[0].filename}`;
      }
      if (files.selfie) {
        updateData.selfieUrl = `/uploads/kyc/${files.selfie[0].filename}`;
      }

      await prisma.kycApplication.update({
        where: { id: application.id },
        data: updateData,
      });

      return successResponse(res, {
        message: 'Documents uploaded successfully',
        documents: updateData,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Upload KYC documents error:', error);
      throw new AppError('GEN_004', 'Document upload failed', 500);
    }
  }

  // Get KYC application details
  async getApplication(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const application = await prisma.kycApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!application) {
        throw new AppError('KYC_004', 'No KYC application found', 404);
      }

      return successResponse(res, { application });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get KYC application error:', error);
      throw new AppError('GEN_004', 'Failed to get KYC application', 500);
    }
  }
}
