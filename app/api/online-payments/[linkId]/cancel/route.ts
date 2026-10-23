import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { cancelLink, syncOnlinePayment, terminateOrder } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// POST /api/online-payments/:linkId/cancel → cancel an unpaid payment link
export async function POST(request: Request, { params }: { params: { linkId: string } }) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { db } = await connectToDatabase();
    // Check first: never cancel something that is already paid.
    const { record } = await syncOnlinePayment(db, params.linkId);
    if (record.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Payment is ${record.status}, cannot cancel`, record }, { status: 400 });
    }
    if (record.kind === 'link') await cancelLink(params.linkId);
    else await terminateOrder(record.orderId || params.linkId);
    return NextResponse.json(await syncOnlinePayment(db, params.linkId));
  } catch (e: any) {
    console.error('Cashfree cancel error:', e);
    return NextResponse.json({ error: e.message || 'Cancel failed' }, { status: 502 });
  }
}
