// Staff lists used for CASH payments.
// - CASH_RECEIVERS: who physically received the cash from the client
//   (saved as paymentDetail.collectorReceiver).
// - CASH_VERIFIERS: who verified that cash payment
//   (saved as paymentDetail.verifiedBy; selecting one also sets verified = true).
export const CASH_RECEIVERS = [
  'Yash Dhanve',
  'Ajay Sampate',
  'Kiran Mane',
  'Girish Mahavale',
  'Trupti',
  'Vedant',
  'Yogita',
  'Rutuja',
  'Vaibhavi',
  'Anuja',
  'Mahesh',
  'Tushar',
  'Tejas',
] as const;

export const CASH_VERIFIERS = ['Tejas', 'Anuja'] as const;

export const isCashMode = (mode?: string): boolean => /cash/i.test(mode || '');
