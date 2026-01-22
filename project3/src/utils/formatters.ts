// Shared formatting utilities

// Format VND currency
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

// Format VND with symbol
export function formatVNDWithSymbol(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

// Format USD currency
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format crypto amount (6 decimal places)
export function formatCrypto(amount: number, decimals: number = 6): string {
  return amount.toFixed(decimals);
}

// Format percentage
export function formatPercent(value: number, decimals: number = 2): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals)}%`;
}

// Format date Vietnamese
export function formatDateVN(date: string | Date): string {
  return new Date(date).toLocaleDateString('vi-VN');
}

// Format datetime Vietnamese
export function formatDateTimeVN(date: string | Date): string {
  return new Date(date).toLocaleString('vi-VN');
}

// Truncate string with ellipsis
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

// Exchange rate (should be fetched from API in production)
export const USD_TO_VND = 24500;

// Convert USD to VND
export function usdToVnd(usd: number): number {
  return usd * USD_TO_VND;
}

// Convert VND to USD
export function vndToUsd(vnd: number): number {
  return vnd / USD_TO_VND;
}
