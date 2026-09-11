// ============================================================================
// 🔹 SHARED FORM VALIDATION HELPERS
// Used across all forms (leads, clients, employees, agreements) so the rules
// for mobile number / email / Aadhaar / PAN stay consistent everywhere.
//
// Each validator returns an error message string when the value is INVALID,
// or `null` when it is valid. Empty values are treated as valid (skipped) so
// these can be used for optional fields — enforce "required" separately.
// ============================================================================

// Indian mobile number: exactly 10 digits starting with 6-9.
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
// Standard email format.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Aadhaar: 12 digits, first digit 2-9 (UIDAI numbers never start with 0 or 1).
export const AADHAAR_REGEX = /^[2-9]\d{11}$/;
// PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const isBlank = (v?: string | null): boolean => !v || !v.trim();

export function validateEmail(value?: string, label = 'Email'): string | null {
  if (isBlank(value)) return null;
  return EMAIL_REGEX.test(value!.trim()) ? null : `${label} is not a valid email address`;
}

export function validateMobile(value?: string, label = 'Mobile number'): string | null {
  if (isBlank(value)) return null;
  return MOBILE_REGEX.test(value!.trim())
    ? null
    : `${label} must be 10 digits and start with 6, 7, 8 or 9`;
}

export function validateAadhaar(value?: string, label = 'Aadhaar number'): string | null {
  if (isBlank(value)) return null;
  return AADHAAR_REGEX.test(value!.trim()) ? null : `${label} must be a valid 12-digit Aadhaar number`;
}

export function validatePan(value?: string, label = 'PAN number'): string | null {
  if (isBlank(value)) return null;
  return PAN_REGEX.test(value!.trim().toUpperCase())
    ? null
    : `${label} must be in the format ABCDE1234F`;
}

// Collect the non-null messages from a set of validator results into one list.
export function collectErrors(...results: (string | null)[]): string[] {
  return results.filter((r): r is string => r != null);
}
