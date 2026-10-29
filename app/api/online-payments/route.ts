import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import {
  appOrigin, cashfreeConfigured, createOrder, createPaymentLink, getUpiOptions, newLinkId, serialize, terminateOrder,
} from '@/lib/cashfree';

export const dynamic = 'force-dynamic';

// When Cashfree says direct UPI isn't enabled, skip that attempt for a while.
let directUpiOffUntil = 0;

// Plain Cashfree order: the CRM / pay page show the direct UPI QR and PhonePe / GPay buttons for it.
const orderFields = (order: any, payPageUrl: string, linkId: string) => ({
  orderId: order.order_id || linkId,
  cfOrderId: order.cf_order_id ? String(order.cf_order_id) : '',
  paymentSessionId: order.payment_session_id,
  linkUrl: payPageUrl,
  payPageUrl,
});

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

// POST /api/online-payments → create a Cashfree Payment Link (opens the UPI app on phones); the QR is drawn from the link
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
  // The payment must belong to a real lead, or it could never be recorded against it.
  if (!ObjectId.isValid(leadId)) return NextResponse.json({ error: 'Invalid lead' }, { status: 400 });
  try {
    const { db } = await connectToDatabase();
    const lead = await db.collection('leads').findOne({ _id: new ObjectId(leadId) }, { projection: { _id: 1 } });
    if (!lead) return NextResponse.json({ error: 'Lead not found. Save the lead first.' }, { status: 400 });
  } catch (e) {
    console.error('Online payment lead check failed:', e);
    return NextResponse.json({ error: 'Could not check the lead. Try again.' }, { status: 500 });
  }
  const linkId = newLinkId(leadId);
  const purpose = String(body.purpose || '').trim() || `LegalWings payment${body.tokenNo ? ` - Token ${body.tokenNo}` : ''}`;
  const origin = appOrigin(request);
  const payPageUrl = `${origin}/pay/${linkId}`; // our status / retry page (customer lands here after paying)

  const common = {
    returnUrl: `${payPageUrl}?done=1`,
    notifyUrl: `${origin}/api/public/cashfree-webhook`, // Cashfree tells us as soon as the user pays
    expiryDays: Number(body.expiryDays) || 7,
  };

  try {
    // 1) Best: plain order + direct UPI QR (upi://pay…). Scanning it in PhonePe / GPay
    //    pays straight away, no web page. Needs Cashfree's S2S "Order Pay" approval;
    //    without it Cashfree refuses and we move on.
    // 2) Otherwise: Cashfree Payment Link (opens the UPI app on phones).
    // 3) If links aren't enabled either: the plain order + our own pay page.
    let kindFields: Record<string, any> | null = null;
    let expiry: string | undefined;
    const orderInput = {
      orderId: linkId, amount, note: purpose, customerId: `LW${phone}`,
      customerName: name, customerPhone: phone, customerEmail: email, ...common,
    };
    let order: any = null;
    if (Date.now() > directUpiOffUntil) {
      try {
        order = await createOrder(orderInput);
        const upi = order?.payment_session_id ? await getUpiOptions(order.payment_session_id) : { available: false };
        if (upi.available) {
          kindFields = orderFields(order, payPageUrl, linkId);
          expiry = order.order_expiry_time;
        } else {
          directUpiOffUntil = Date.now() + 30 * 60 * 1000; // don't re-test on every click
        }
      } catch (e: any) {
        console.warn('Direct UPI order failed (non-fatal):', e?.message || e);
      }
    }

    if (!kindFields) try {
      const link: any = await createPaymentLink({
        linkId, amount, purpose, customerName: name, customerPhone: phone, customerEmail: email, ...common,
      });
      if (!link?.link_url) throw new Error('Cashfree did not return a payment link');
      kindFields = {
        kind: 'link',
        orderId: '',
        cfLinkId: link.cf_link_id ? String(link.cf_link_id) : '',
        linkUrl: String(link.link_url), // what the customer gets, and what the QR holds
        payPageUrl,
      };
      expiry = link.link_expiry_time;
      if (order?.order_id) terminateOrder(order.order_id).catch(() => {}); // unused test order
    } catch (e: any) {
      const notEnabled = /not enabled|not approved/i.test(e?.message || '') || /not_enabled|not_approved/i.test(e?.code || '');
      if (!notEnabled) throw e;
      console.warn('Cashfree link creation not enabled on this account; using order checkout instead');
      if (!order) order = await createOrder(orderInput);
      kindFields = orderFields(order, payPageUrl, linkId);
      expiry = order.order_expiry_time;
    }

    const { db } = await connectToDatabase();
    const doc = {
      ...kindFields,
      leadId,
      tokenNo: body.tokenNo || '',
      linkId,
      amount,
      amountPaid: 0,
      currency: 'INR',
      purpose,
      payerType,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      status: 'ACTIVE',
      expiresAt: expiry ? new Date(expiry) : null,
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
    console.error('Cashfree create link error:', e?.message || e);
    return NextResponse.json({ error: e.message || 'Failed to create payment link' }, { status: e.status && e.status < 500 ? 400 : 502 });
  }
}
