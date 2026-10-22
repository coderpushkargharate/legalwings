import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { cashfreeMode, syncOnlinePayment } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

const ID_RE = /^[A-Za-z0-9_-]{1,50}$/;

// Only what the customer's pay page needs — no lead data, no staff names.
function publicView(r: any) {
  return {
    amount: r.amount,
    amountPaid: r.amountPaid || 0,
    status: r.status,
    customerName: r.customerName || '',
    purpose: r.purpose || '',
    tokenNo: r.tokenNo || '',
    expiresAt: r.expiresAt || null,
    paidAt: r.paidAt || null,
    reference: r.transactions?.[0]?.utr || r.transactions?.[0]?.cfPaymentId || '',
    lastAttempt: r.lastAttempt?.status || null,
  };
}

// GET /api/public/pay/:linkId → details + checkout session for the pay page
export async function GET(_request: Request, { params }: { params: { linkId: string } }) {
  if (!ID_RE.test(params.linkId)) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  try {
    const { db } = await connectToDatabase();
    let record: any = await db.collection('online_payments').findOne({ linkId: params.linkId });
    if (!record) return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
    // Refresh from Cashfree so an expired / already-paid link is shown correctly.
    try { record = { ...record, ...(await syncOnlinePayment(db, params.linkId)).record }; } catch { /* show stored state */ }
    return NextResponse.json({
      ...publicView(record),
      mode: cashfreeMode(),
      paymentSessionId: record.status === 'ACTIVE' ? record.paymentSessionId : null,
    });
  } catch (e) {
    console.error('Public pay GET error:', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// POST /api/public/pay/:linkId → re-check the status after checkout
export async function POST(_request: Request, { params }: { params: { linkId: string } }) {
  if (!ID_RE.test(params.linkId)) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  try {
    const { db } = await connectToDatabase();
    const { record } = await syncOnlinePayment(db, params.linkId);
    return NextResponse.json(publicView(record));
  } catch (e: any) {
    return NextResponse.json({ error: e.status === 404 ? 'Payment link not found' : 'Could not check status' }, { status: e.status === 404 ? 404 : 502 });
  }
}
