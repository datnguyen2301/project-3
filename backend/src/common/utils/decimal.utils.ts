import { Decimal } from '@prisma/client/runtime/library';

/**
 * Convert Decimal to clean string without trailing zeros
 * Returns string to ensure proper display in API responses
 */
export const decimalToNumber = (decimal: Decimal | null | undefined): string => {
  if (!decimal) return '0';
  // parseFloat removes trailing zeros, then toString for clean output
  return parseFloat(decimal.toString()).toString();
};

/**
 * Convert Decimal to number for calculations
 */
export const toNumber = (decimal: Decimal | null | undefined): number => {
  if (!decimal) return 0;
  return parseFloat(decimal.toString());
};

/**
 * Format number for display - removes trailing zeros
 * Examples: 
 *   97341.39000000 → 97341.39
 *   0.00100000 → 0.001
 *   100.00 → 100
 */
export const formatPrice = (value: number | Decimal | string | null | undefined, maxDecimals: number = 8): string => {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : 
              value instanceof Decimal ? parseFloat(value.toString()) : value;
  
  if (isNaN(num)) return '0';
  
  // Format với số thập phân tối đa, sau đó xóa trailing zeros
  return parseFloat(num.toFixed(maxDecimals)).toString();
};

/**
 * Format price with specific decimal places based on value
 * Prices > 1000: 2 decimals
 * Prices > 1: 4 decimals  
 * Prices < 1: 8 decimals
 */
export const formatSmartPrice = (value: number | Decimal | string | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  
  const num = typeof value === 'string' ? parseFloat(value) : 
              value instanceof Decimal ? parseFloat(value.toString()) : value;
  
  if (isNaN(num)) return '0';
  
  let decimals = 8;
  if (Math.abs(num) >= 1000) decimals = 2;
  else if (Math.abs(num) >= 1) decimals = 4;
  
  return parseFloat(num.toFixed(decimals)).toString();
};

export const numberToDecimal = (num: number): Decimal => {
  return new Decimal(num);
};

export const addDecimals = (a: Decimal, b: Decimal): Decimal => {
  return new Decimal(a).plus(new Decimal(b));
};

export const subtractDecimals = (a: Decimal, b: Decimal): Decimal => {
  return new Decimal(a).minus(new Decimal(b));
};

export const multiplyDecimals = (a: Decimal, b: Decimal): Decimal => {
  return new Decimal(a).times(new Decimal(b));
};

export const divideDecimals = (a: Decimal, b: Decimal): Decimal => {
  return new Decimal(a).dividedBy(new Decimal(b));
};

export const compareDecimals = (a: Decimal, b: Decimal): number => {
  return new Decimal(a).comparedTo(new Decimal(b));
};
