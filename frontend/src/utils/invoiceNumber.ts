const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS  = '23456789';

function pick(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * Generates a unique 10-char receipt/invoice number.
 * Strictly alternating letters and digits - no two consecutive same type.
 * Example: A3K7M2P9XQ
 */
export function generateInvoiceNumber(): string {
  let useLetter = Math.random() < 0.5;
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += useLetter ? pick(LETTERS) : pick(DIGITS);
    useLetter = !useLetter;
  }
  return result;
}
