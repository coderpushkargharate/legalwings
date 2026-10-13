// ============================================================================
// 🔹 Shared lead payment math — one formula for every screen.
//   Legal Fees  = payment.totalAmount (Total Agreement Amount)
//   Received    = Σ paymentDetails[].paymentAmount (owner + tenant)
//   Balance due = Legal Fees − Received (never below 0)
// Commission (AC Amount) is OUR expense, so it is never added to what the
// client owes. Computed live from paymentDetails — the stored
// outstanding/pending/balance fields can be stale and are only fallbacks.
// ============================================================================

type Num = number | string | null | undefined;

interface PaymentLike {
  payment?: {
    totalAmount?: Num;
    outstandingAmount?: Num;
    totalReceivedAmount?: Num;
    paidAmount?: Num;
  } | null;
  paymentDetails?: Array<{ paymentAmount?: Num }> | null;
}

export const toNum = (v: Num): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

// Total Agreement Amount; older leads without totalAmount fall back to the
// stored outstandingAmount (which the lead form sets equal to Legal Fees).
export const legalFeesOf = (lead: PaymentLike): number =>
  toNum(lead.payment?.totalAmount) || toNum(lead.payment?.outstandingAmount);

export const receivedOf = (lead: PaymentLike): number => {
  const fromDetails = (lead.paymentDetails || []).reduce((s, p) => s + toNum(p?.paymentAmount), 0);
  if (fromDetails > 0) return fromDetails;
  return toNum(lead.payment?.totalReceivedAmount) || toNum(lead.payment?.paidAmount);
};

export const balanceDueOf = (lead: PaymentLike): number =>
  Math.max(0, legalFeesOf(lead) - receivedOf(lead));
