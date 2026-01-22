// KYC Verification API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KYCStatusResponse {
  success: boolean;
  data?: {
    status?: KYCStatus;
    kycStatus?: string;
    submittedAt?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    application?: {
      status: string;
      rejectionReason?: string;
      reviewedAt?: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface KYCSubmitResponse {
  success: boolean;
  data?: {
    status: KYCStatus;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Get KYC status
export async function getKYCStatus(): Promise<KYCStatusResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to check KYC status',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/kyc/status`);

    return await response.json();
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
      },
    };
  }
}

// Submit KYC application data
export async function submitKYC(kycData: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phoneNumber: string;
  idType: string;
  idNumber: string;
}): Promise<KYCSubmitResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to submit KYC',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/kyc/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kycData),
    });

    return await response.json();
  } catch (error) {
    console.error('Error submitting KYC:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to submit KYC',
      },
    };
  }
}

// Upload KYC documents
export async function uploadKYCDocuments(
  documents: {
    frontDocument: File;
    backDocument: File;
    selfie: File;
  }
): Promise<KYCSubmitResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to upload documents',
      },
    };
  }

  try {
    const formData = new FormData();
    formData.append('frontDocument', documents.frontDocument);
    formData.append('backDocument', documents.backDocument);
    formData.append('selfie', documents.selfie);

    const response = await fetchWithAuth(`${API_BASE}/kyc/upload-document`, {
      method: 'POST',
      // Don't set Content-Type for FormData
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error('Error uploading KYC documents:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to upload documents',
      },
    };
  }
}
