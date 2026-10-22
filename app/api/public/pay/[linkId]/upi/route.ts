import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getUpiOptions } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// GET /api/public/pay/:linkId/upi → PhonePe / GPay / Paytm app links + UPI QR for the customer page
export async function GET(_request: Request, { params }: { params: { linkId: string } }) {
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(params.linkId)) return NextResponse.json({ available: false }, { status: 404 });
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('online_payments').findOne(
      { linkId: params.linkId },
      { projection: { status: 1, paymentSessionId: 1 } },
    );
    if (!record || record.status !== 'ACTIVE' || !record.paymentSessionId) {
      return NextResponse.json({ available: false });
    }
    const upi = await getUpiOptions(record.paymentSessionId);
    return NextResponse.json({ available: upi.available, upiUrl: upi.upiUrl, intents: upi.intents, qrcode: upi.qrcode });
  } catch (e) {
    console.error('Public UPI options error:', e);
    return NextResponse.json({ available: false });
  }
}
