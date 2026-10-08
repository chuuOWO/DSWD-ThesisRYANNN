// ==========================================
// Strict Input Validation & Sanitization Helpers
// ==========================================

/**
 * Strips any character that is NOT a letter, space, period, hyphen, or apostrophe.
 * Used for names, municipal labels, and text-only fields.
 */
export const sanitizeTextOnly = (val: string): string => {
  return val.replace(/[^a-zA-Z\s.'-]/g, '');
};

/**
 * Strips any non-digit character.
 * Used for quantities, amounts, inventory counts, and positive integers.
 */
export const sanitizeNumbersOnly = (val: string): string => {
  return val.replace(/\D/g, '');
};

/**
 * Allows digits and an optional single leading '+' sign.
 * Used for contact numbers and mobile phone numbers.
 */
export const sanitizePhone = (val: string): string => {
  const cleaned = val.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }
  return cleaned.replace(/\D/g, '');
};

/**
 * Strips any character that is NOT alphanumeric or a hyphen.
 * Used for codes, truck IDs, plate numbers, and delivery receipts.
 */
export const sanitizeAlphanumeric = (val: string): string => {
  return val.replace(/[^a-zA-Z0-9-]/g, '');
};

/**
 * Allows alphanumeric characters, spaces, hyphens, slashes, hashes, underscores, and periods.
 * Used for RIS (Request and Issue Slip), delivery manifests, and incident references without breaking typing.
 */
export const sanitizeSlipReference = (val: string): string => {
  return val.replace(/[^a-zA-Z0-9\s\-_/#.]/g, '');
};

