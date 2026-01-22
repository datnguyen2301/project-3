// Portfolio Analytics API Service
import { getAuthToken } from './authApi';
import { fetchWithAuth } from './apiHelper';

const API_BASE = '/api';

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface AssetAllocation {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
}

export interface PerformanceData {
  currentValue: number;
  investedValue: number;
  totalProfit: number;
  profitPercentage: number;
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  history: HistoryPoint[];
}

export interface AllocationData {
  assets: AssetAllocation[];
  totalValue: number;
}

// Get portfolio performance
export async function getPerformance(period: '7d' | '30d' | '90d' | '1y' = '7d'): Promise<PerformanceData> {
  const token = getAuthToken();

  const defaultData: PerformanceData = {
    currentValue: 0,
    investedValue: 0,
    totalProfit: 0,
    profitPercentage: 0,
    totalTrades: 0,
    winRate: 0,
    wins: 0,
    losses: 0,
    history: [],
  };

  if (!token) {
    console.log('[Portfolio] No token, returning default data');
    return defaultData;
  }

  try {
    console.log('[Portfolio] Fetching performance for period:', period);
    
    // Try /api/portfolio/performance first, fallback to /api/portfolio
    let response = await fetchWithAuth(`${API_BASE}/portfolio/performance?period=${period}`);
    let result = await response.json();
    console.log('[Portfolio] Performance response:', result);
    
    // If no data or error, try main portfolio endpoint
    if (!result.success || !result.data) {
      console.log('[Portfolio] Trying main endpoint /api/portfolio');
      response = await fetchWithAuth(`${API_BASE}/portfolio`);
      result = await response.json();
      console.log('[Portfolio] Main portfolio response:', result);
    }
    
    // Extract data from different possible structures
    const data = result.data || result;
    
    if (data) {
      return {
        currentValue: Number(data.currentValue || data.totalValue || data.total || 0),
        investedValue: Number(data.investedValue || data.invested || 0),
        totalProfit: Number(data.totalProfit || data.pnl || data.profit || 0),
        profitPercentage: Number(data.profitPercentage || data.pnlPercent || data.profitPercent || 0),
        totalTrades: Number(data.totalTrades || data.trades || 0),
        winRate: Number(data.winRate || 0),
        wins: Number(data.wins || data.winningTrades || 0),
        losses: Number(data.losses || data.losingTrades || 0),
        history: data.history || data.portfolioHistory || [],
      };
    }
    
    return defaultData;
  } catch (error) {
    console.error('Error fetching performance:', error);
    return defaultData;
  }
}

// Get asset allocation
export async function getAllocation(): Promise<AllocationData> {
  const token = getAuthToken();

  const defaultData: AllocationData = { assets: [], totalValue: 0 };

  if (!token) {
    console.log('[Portfolio] No token for allocation');
    return defaultData;
  }

  try {
    console.log('[Portfolio] Fetching allocation...');
    const response = await fetchWithAuth(`${API_BASE}/portfolio/allocation`);

    const result = await response.json();
    console.log('[Portfolio] Allocation response:', result);
    
    if (result.success && result.data) {
      // Normalize assets data
      const assets = (result.data.allocation || result.data.assets || []).map((a: Record<string, unknown>) => ({
        symbol: String(a.symbol || a.asset || ''),
        name: String(a.name || a.symbol || ''),
        value: Number(a.value || a.usdValue || 0),
        percentage: Number(a.percentage || a.percent || 0),
      }));
      
      return {
        assets,
        totalValue: Number(result.data.totalValue) || 0,
      };
    }
    
    return defaultData;
  } catch (error) {
    console.error('Error fetching allocation:', error);
    return defaultData;
  }
}

// Export portfolio data
export async function exportPortfolio(format: 'csv' | 'json' = 'csv'): Promise<Blob | null> {
  const token = getAuthToken();

  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/portfolio/export?format=${format}`);

    if (response.ok) {
      return await response.blob();
    }
    
    return null;
  } catch (error) {
    console.error('Error exporting portfolio:', error);
    return null;
  }
}

// P&L History interface
export interface PnLRecord {
  id: string;
  date: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
}

// Get P&L history
export async function getPnLHistory(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<{
  records: PnLRecord[];
  summary: {
    totalPnL: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
  };
}> {
  const token = getAuthToken();

  const defaultResult = {
    records: [],
    summary: {
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
    },
  };

  if (!token) {
    return defaultResult;
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = queryParams.toString()
      ? `${API_BASE}/portfolio/pnl?${queryParams}`
      : `${API_BASE}/portfolio/pnl`;

    const response = await fetchWithAuth(url);
    const result = await response.json();

    if (result.success && result.data) {
      return {
        records: result.data.records || result.data.history || [],
        summary: result.data.summary || defaultResult.summary,
      };
    }

    return defaultResult;
  } catch (error) {
    console.error('Error fetching P&L history:', error);
    return defaultResult;
  }
}

// Get portfolio overview (combined endpoint)
export async function getPortfolioOverview(): Promise<{
  totalValue: number;
  totalPnL: number;
  pnlPercent: number;
  allocation: AssetAllocation[];
  recentTrades: number;
}> {
  const token = getAuthToken();

  const defaultResult = {
    totalValue: 0,
    totalPnL: 0,
    pnlPercent: 0,
    allocation: [],
    recentTrades: 0,
  };

  if (!token) {
    return defaultResult;
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/portfolio`);
    const result = await response.json();

    if (result.success && result.data) {
      return {
        totalValue: result.data.totalValue || 0,
        totalPnL: result.data.totalPnL || result.data.pnl || 0,
        pnlPercent: result.data.pnlPercent || result.data.pnlPercentage || 0,
        allocation: result.data.allocation || result.data.assets || [],
        recentTrades: result.data.recentTrades || 0,
      };
    }

    return defaultResult;
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    return defaultResult;
  }
}

// Portfolio history point
export interface PortfolioHistoryPoint {
  date: string;
  totalValue: number;
  assets?: Record<string, unknown>;
}

// Get portfolio history
export async function getPortfolioHistory(days: number = 30): Promise<{
  history: PortfolioHistoryPoint[];
}> {
  const token = getAuthToken();

  const defaultResult = { history: [] };

  if (!token) {
    return defaultResult;
  }

  try {
    console.log('[Portfolio] Fetching history for', days, 'days');
    const response = await fetchWithAuth(`${API_BASE}/portfolio/history?days=${days}`);
    const result = await response.json();

    console.log('[Portfolio] History response:', result);

    if (result.success && result.data) {
      // Normalize history data
      const history = (result.data.history || result.data || []).map((h: Record<string, unknown>) => ({
        date: String(h.date || h.createdAt || ''),
        totalValue: Number(h.totalValue || h.value || 0),
        assets: h.assets || h.snapshotData || {},
      }));

      return { history };
    }

    return defaultResult;
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    return defaultResult;
  }
}
