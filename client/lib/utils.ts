import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate Algerian phone number.
 * Must start with 05, 06, or 07 and be exactly 10 digits.
 */
export function isValidAlgerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^(0[567]\d{8})$/.test(cleaned);
}

/**
 * Format phone number for display: 05XX XX XX XX
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
  }
  return phone;
}
