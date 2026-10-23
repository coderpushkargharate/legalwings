import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getUpiOptions } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// GET /api/online-payments/:linkId/upi → direct UPI QR / app links for the CRM screen
export async function GET(request: Request, { params }: { params: { linkId: string } }) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('online_payments').findOne({ linkId: params.linkId });
    if (!record) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (record.status !== 'ACTIVE') {
      return NextResponse.json({ available: false, reason: `Payment is ${record.status}` });
    }
    // Payment links: the QR is Cashfree's link (opens the UPI app on phones). A raw upi:// QR
    // would need Cashfree's S2S "Order Pay" approval, which this account does not have.
    if (record.kind === 'link' || !record.paymentSessionId) {
      return NextResponse.json({ available: false, reason: 'link' });
    }
    return NextResponse.json(await getUpiOptions(record.paymentSessionId));
  } catch (e: any) {
    console.error('UPI options error:', e);
    return NextResponse.json({ available: false, reason: 'Could not load UPI details' });
  }
}
