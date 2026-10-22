import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { appOrigin, cashfreeConfigured, createOrder, newLinkId, serialize } from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// GET /api/online-payments?leadId=...  → all online payment links for a lead
// GET /api/online-payments              → latest 200 (all leads)
export async function GET(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token || !verifyToken(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    const { db } = await connectToDatabase();
    const rows = await db.collection('online_payments')
      .find(leadId ? { leadId } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json({ configured: cashfreeConfigured(), payments: rows.map(serialize) });
  } catch (e) {
    console.error('Online payments GET error:', e);
    return NextResponse.json({ error: 'Failed to load online payments' }, { status: 500 });
  }
}

// POST /api/online-payments → create a Cashfree payment link (QR is drawn on the client from the link)
export async function POST(request: Request) {
  const token = getTokenFromHeaders(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!cashfreeConfigured()) {
    return NextResponse.json({ error: 'Online payments are not set up (Cashfree keys missing on server)' }, { status: 500 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const amount = Math.round(Number(body.amount) * 100) / 100;
  const phone = String(body.customerPhone || '').replace(/\D/g, '').slice(-10);
  const email = String(body.customerEmail || '').trim();
  const name = String(body.customerName || '').trim().slice(0, 100);
  const payerType = body.payerType === 'TENANT' ? 'TENANT' : 'OWNER';

  if (!body.leadId) return NextResponse.json({ error: 'Save the lead first' }, { status: 400 });
  if (!isFinite(amount) || amount < 1) return NextResponse.json({ error: 'Amount must be at least ₹1' }, { status: 400 });
  if (amount > 1000000) return NextResponse.json({ error: 'Amount is too large' }, { status: 400 });
  if (!/^[6-9]\d{9}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid 10-digit mobile number' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

  const leadId = String(body.leadId);
  const linkId = newLinkId(leadId);
  const purpose = String(body.purpose || '').trim() || `LegalWings payment${body.tokenNo ? ` - Token ${body.tokenNo}` : ''}`;
  const origin = appOrigin(request);
  const linkUrl = `${origin}/pay/${linkId}`;

  try {
    const order: any = await createOrder({
      orderId: linkId,
      amount,
      note: purpose,
      customerId: `LW${phone}`,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      returnUrl: `${linkUrl}?done=1`,
      notifyUrl: `${origin}/api/public/cashfree-webhook`, // Cashfree tells us as soon as the user pays
      expiryDays: Number(body.expiryDays) || 7,
    });

    const { db } = await connectToDatabase();
    const doc = {
      leadId,
      tokenNo: body.tokenNo || '',
      linkId,
      orderId: order.order_id || linkId,
      cfOrderId: order.cf_order_id ? String(order.cf_order_id) : '',
      paymentSessionId: order.payment_session_id,
      linkUrl,
      amount,
      amountPaid: 0,
      currency: 'INR',
      purpose,
      payerType,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      status: order.order_status || 'ACTIVE',
      expiresAt: order.order_expiry_time ? new Date(order.order_expiry_time) : null,
      transactions: [],
      recordedInLead: false,
      createdByUserId: user.userId,
      createdByUserName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection('online_payments').insertOne(doc);
    return NextResponse.json(serialize({ _id: result.insertedId, ...doc }), { status: 201 });
  } catch (e: any) {
    console.error('Cashfree create order error:', e);
    return NextResponse.json({ error: e.message || 'Failed to create payment link' }, { status: e.status && e.status < 500 ? 400 : 502 });
  }
}
