import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { syncOnlinePayment } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// Cashfree calls this when a payment link is paid. The body is never trusted:
// only the link id is read from it, and the real status is re-checked with Cashfree.
export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    // Payment webhooks carry data.order.order_id (our linkId is the order id).
    const linkId = body?.data?.order?.order_id || body?.data?.link_id || body?.order_id;
    if (!linkId || typeof linkId !== 'string' || !/^[A-Za-z0-9_-]{1,50}$/.test(linkId)) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    const { db } = await connectToDatabase();
    const exists = await db.collection('online_payments').findOne({ linkId }, { projection: { _id: 1 } });
    if (exists) await syncOnlinePayment(db, linkId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Cashfree webhook error:', e);
    // Reply 200 so Cashfree stops retrying; Verify / auto-refresh in the CRM will catch up.
    return NextResponse.json({ ok: true });
  }
}
