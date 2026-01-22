// Earn/Staking API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export interface EarnProduct {
  id: string;
  symbol: string;
  name: string;
  type: 'flexible' | 'locked';
  apy: number;
  duration?: number; // in days
  minAmount: number;
  maxAmount: number;
  totalStaked: number;
  available: number;
  risk?: 'low' | 'medium' | 'high';
}

export interface Stake {
  id: string;
  productId: string;
  symbol: string;
  amount: number;
  apy: number;
  type: 'flexible' | 'locked';
  startDate: string;
  endDate: string | null;
  earned: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface StakeSummary {
  totalStaked: number;
  totalEarned: number;
  activeStakes: number;
}

// Get earn products
export async function getEarnProducts(type?: 'flexible' | 'locked'): Promise<EarnProduct[]> {
  try {
    const url = type 
      ? `${API_BASE}/earn/products?type=${type.toUpperCase()}`
      : `${API_BASE}/earn/products`;
    
    console.log('[EarnAPI] Fetching products from:', url);
    // Sử dụng fetchWithAuth để gửi token
    const response = await fetchWithAuth(url);
    const result = await response.json();
    
    console.log('[EarnAPI] Products response:', result);
    
    // Handle different response formats from backend
    let products: Record<string, unknown>[] = [];
    
    if (result.success && result.data?.products) {
      products = result.data.products;
    } else if (result.success && Array.isArray(result.data)) {
      products = result.data;
    } else if (Array.isArray(result.products)) {
      products = result.products;
    } else if (Array.isArray(result)) {
      products = result;
    }
    
    console.log('[EarnAPI] Parsed products:', products);
    
    if (products.length > 0) {
      // Normalize data from backend
      return products.map((p: Record<string, unknown>) => ({
        id: (p.id || p._id) as string,
        symbol: (p.symbol || p.asset || 'UNKNOWN') as string,
        name: (p.name || p.symbol || 'Unknown') as string,
        apy: Number(p.apy) || 0, // Đảm bảo apy là number
        minAmount: Number(p.minAmount) || 0,
        maxAmount: Number(p.maxAmount) || 1000000,
        type: ((p.type as string) || 'flexible').toLowerCase() as 'flexible' | 'locked',
        duration: (p.duration || p.durationDays || p.lockDays || undefined) as number | undefined,
        risk: (p.risk || 'medium') as 'low' | 'medium' | 'high',
        totalStaked: (p.totalStaked || 0) as number,
        available: (p.available || p.maxAmount || 1000000) as number,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('[EarnAPI] Error fetching earn products:', error);
    return [];
  }
}

// Stake crypto
export async function stake(productId: string, amount: number): Promise<{
  success: boolean;
  data?: { stake: Stake; message: string };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to stake',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/earn/stake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, amount }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error staking:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to stake',
      },
    };
  }
}

// Unstake
export async function unstake(stakeId: string): Promise<{
  success: boolean;
  data?: { principal: number; rewards: number; total: number };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to unstake',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/earn/unstake/${stakeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Error unstaking:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to unstake',
      },
    };
  }
}

// Get my stakes
export async function getMyStakes(): Promise<{
  stakes: Stake[];
  summary: StakeSummary;
}> {
  const token = getAuthToken();

  const defaultSummary: StakeSummary = { totalStaked: 0, totalEarned: 0, activeStakes: 0 };

  if (!token) {
    return { stakes: [], summary: defaultSummary };
  }

  try {
    console.log('[EarnAPI] Fetching my stakes');
    const response = await fetchWithAuth(`${API_BASE}/earn/my-stakes`);

    const result = await response.json();
    
    console.log('[EarnAPI] My stakes response:', result);
    
    if (result.success && result.data) {
      // Normalize data from backend
      const stakes = (result.data.stakes || []).map((s: Record<string, unknown>) => ({
        ...s,
        type: (s.type as string)?.toLowerCase() || 'flexible',
        status: (s.status as string)?.toLowerCase() || 'active',
        earned: s.earned || s.rewards || 0,
      }));

      const summary = result.data.summary || {};
      return {
        stakes,
        summary: {
          totalStaked: summary.totalStaked || 0,
          totalEarned: summary.totalEarned || summary.totalRewards || 0,
          activeStakes: summary.activeStakes || summary.activeCount || 0,
        },
      };
    }
    
    return { stakes: [], summary: defaultSummary };
  } catch (error) {
    console.error('Error fetching stakes:', error);
    return { stakes: [], summary: defaultSummary };
  }
}

// Reward history interface
export interface RewardHistory {
  id: string;
  stakeId: string;
  symbol: string;
  amount: number;
  type: 'daily' | 'compound' | 'bonus';
  createdAt: string;
}

// Get reward history
export async function getRewardHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  rewards: RewardHistory[];
  total: number;
}> {
  const token = getAuthToken();

  if (!token) {
    return { rewards: [], total: 0 };
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = queryParams.toString() 
      ? `${API_BASE}/earn/rewards?${queryParams}`
      : `${API_BASE}/earn/rewards`;

    const response = await fetchWithAuth(url);
    const result = await response.json();

    if (result.success && result.data) {
      return {
        rewards: result.data.rewards || [],
        total: result.data.total || result.data.rewards?.length || 0,
      };
    }

    return { rewards: [], total: 0 };
  } catch (error) {
    console.error('Error fetching reward history:', error);
    return { rewards: [], total: 0 };
  }
}

// Claim rewards
export async function claimRewards(stakeId?: string): Promise<{
  success: boolean;
  data?: { amount: number; symbol: string };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to claim rewards',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/earn/claim-rewards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stakeId }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to claim rewards',
      },
    };
  }
}
