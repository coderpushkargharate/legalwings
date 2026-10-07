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

// Person names: letters, spaces, dot, apostrophe and hyphen only.
export const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;
// Money: positive number with at most 2 decimals.
export const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
// Transaction / UTR / cheque reference: 4-30 letters or digits.
export const TRANSACTION_REGEX = /^[A-Za-z0-9]{4,30}$/;

export function validateName(value?: string, label = 'Name'): string | null {
  if (isBlank(value)) return null;
  return NAME_REGEX.test(value!.trim()) ? null : `${label} should contain only letters`;
}

export function validateAmount(value?: string | number, label = 'Amount'): string | null {
  const v = value == null ? '' : String(value);
  if (isBlank(v)) return null;
  return AMOUNT_REGEX.test(v.trim()) ? null : `${label} must be a valid amount (e.g. 5000 or 5000.50)`;
}

export function validateTransactionNumber(value?: string, label = 'Transaction number'): string | null {
  if (isBlank(value)) return null;
  return TRANSACTION_REGEX.test(value!.trim()) ? null : `${label} must be 4-30 letters/digits, no spaces or symbols`;
}

export function validateAge(value?: string | number, label = 'Age'): string | null {
  const v = value == null ? '' : String(value);
  if (isBlank(v)) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 18 && n <= 120 ? null : `${label} must be between 18 and 120`;
}

// End date must not be before start date (both optional).
export function validateDateRange(start?: string, end?: string, label = 'End date'): string | null {
  if (isBlank(start) || isBlank(end)) return null;
  const s = new Date(start!.slice(0, 10)).getTime();
  const e = new Date(end!.slice(0, 10)).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return e >= s ? null : `${label} cannot be before start date`;
}

export interface PaymentRowLike {
  paymentDate?: string;
  paymentAmount?: string | number;
  modeOfPayment?: string;
  payerName?: string;
  transactionNumber?: string;
}
export type PaymentRowErrors = Partial<Record<'paymentDate' | 'paymentAmount' | 'modeOfPayment' | 'payerName' | 'transactionNumber', string>>;

// A payment row is optional as a whole, but once anything is filled in it needs
// a date, an amount, a mode and a transaction number.
export function validatePaymentRow(p: PaymentRowLike): PaymentRowErrors {
  const errs: PaymentRowErrors = {};
  const amount = p.paymentAmount == null ? '' : String(p.paymentAmount);
  const touched = [p.paymentDate, amount, p.modeOfPayment, p.payerName, p.transactionNumber].some(v => !isBlank(v));
  if (!touched) return errs;
  if (isBlank(p.paymentDate)) errs.paymentDate = 'Payment date is required';
  if (isBlank(amount)) errs.paymentAmount = 'Amount is required';
  else if (validateAmount(amount)) errs.paymentAmount = validateAmount(amount)!;
  else if (Number(amount) <= 0) errs.paymentAmount = 'Amount must be greater than 0';
  if (isBlank(p.modeOfPayment)) errs.modeOfPayment = 'Select payment mode';
  const nameErr = validateName(p.payerName, 'Payer name');
  if (nameErr) errs.payerName = nameErr;
  if (isBlank(p.transactionNumber)) errs.transactionNumber = 'Transaction number is required';
  else {
    const txnErr = validateTransactionNumber(p.transactionNumber);
    if (txnErr) errs.transactionNumber = txnErr;
  }
  return errs;
}

// Collect the non-null messages from a set of validator results into one list.
export function collectErrors(...results: (string | null)[]): string[] {
  return results.filter((r): r is string => r != null);
}
