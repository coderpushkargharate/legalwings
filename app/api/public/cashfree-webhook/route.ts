import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { syncOnlinePayment, verifyWebhookSignature } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

const ID_RE = /^[A-Za-z0-9_-]{1,50}$/;

// Cashfree calls this when a payment link / order is paid, fails, expires or is cancelled.
// 1) The signature is checked against the raw body (x-webhook-signature / x-webhook-timestamp).
// 2) Only ids are read from the body; the real status is re-read from Cashfree's API.
// 3) syncOnlinePayment adds the payment to the lead at most once, so retries are safe.
export async function POST(request: Request) {
  const raw = await request.text();
  const ok = verifyWebhookSignature(raw, request.headers.get('x-webhook-timestamp'), request.headers.get('x-webhook-signature'));
  if (!ok) {
    console.warn('Cashfree webhook rejected: bad or missing signature');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    body = Object.fromEntries(new URLSearchParams(raw)); // older form-encoded webhooks
  }

  // Payment-link events carry data.link_id; payment events for a link carry order_tags.link_id;
  // older direct orders use our id as data.order.order_id.
  const ids = [
    body?.data?.link_id,
    body?.data?.order?.order_tags?.link_id,
    body?.data?.order?.order_id,
    body?.link_id, body?.linkId, body?.order_id, body?.orderId,
  ].filter((v): v is string => typeof v === 'string' && ID_RE.test(v));
  if (!ids.length) return NextResponse.json({ ok: true, ignored: true });

  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('online_payments').findOne(
      { $or: [{ linkId: { $in: ids } }, { orderId: { $in: ids } }] },
      { projection: { linkId: 1 } },
    );
    if (record) await syncOnlinePayment(db, record.linkId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Cashfree webhook error:', e?.message || e);
    // Ask Cashfree to retry; the CRM's Verify / auto-refresh also catches up.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
