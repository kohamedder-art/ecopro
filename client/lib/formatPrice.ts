/**
 * Formats a price value for display in input fields.
 * Removes .00 from whole numbers (e.g., 6000.00 -> 6000)
 * Keeps decimal places for non-whole numbers (e.g., 6000.50 -> 6000.50)
 */

export function formatPriceForInput(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    return '';
  }
  
  // If the number is a whole number, return it without decimals
  if (num % 1 === 0) {
    return num.toString();
  }
  
  // Otherwise, return with up to 2 decimal places
  return num.toFixed(2);
}

/**
 * Formats a price value for display (with locale string formatting)
 * Removes .00 from whole numbers
 */
export function formatPriceForDisplay(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '0';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || !isFinite(num)) {
    return '0';
  }
  
  // If the number is a whole number, return it without decimals
  if (num % 1 === 0) {
    return Math.round(num).toLocaleString();
  }
  
  // Otherwise, return with up to 2 decimal places
  return num.toFixed(2);
}
