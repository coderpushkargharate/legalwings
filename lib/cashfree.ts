// ============================================================================
// 🔹 Cashfree Payment Gateway — server-only helper (Orders API, v2023-08-01).
// Keys come from env (never sent to the browser):
//   CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV = production | sandbox
//
// Flow: CRM creates a Cashfree order → we give the customer our own pay page
// (/pay/<linkId>, also shown as a QR) → that page opens Cashfree's secure
// checkout → status is re-read from Cashfree (Verify button, auto-refresh,
// return from checkout, webhook). Once PAID, the payment is added to the
// lead as an ONLINE payment line.
// ============================================================================
import crypto from 'crypto';
import { ObjectId, type Db } from 'mongodb';

const API_VERSION = '2023-08-01';

export const cashfreeMode = (): 'production' | 'sandbox' =>
  (process.env.CASHFREE_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';

const baseUrl = () => (cashfreeMode() === 'sandbox' ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg');

export function cashfreeConfigured(): boolean {
  return !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

async function cf<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!cashfreeConfigured()) throw new Error('Cashfree keys are not configured on the server');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': process.env.CASHFREE_APP_ID as string,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY as string,
        'x-api-version': API_VERSION,
        ...(init.headers as Record<string, string> || {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    if (!res.ok) {
      const err: any = new Error(data?.message || `Cashfree error ${res.status}`);
      err.status = res.status;
      err.code = data?.code;
      throw err;
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Unique, hard-to-guess id used both as the Cashfree order_id and in the /pay/<id> URL. */
export function newLinkId(leadId: string): string {
  return `LW_${leadId.slice(-6)}_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.toUpperCase();
}

/** Public base URL of this CRM (used for the pay page, return URL and webhook). */
export function appOrigin(request: Request): string {
  const env = process.env.APP_BASE_URL || process.env.URL; // URL is set automatically on Netlify
  if (env) return env.replace(/\/$/, '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  note: string;
  customerId: string;
  customerName?: string;
  customerPhone: string;
  customerEmail?: string;
  returnUrl?: string;
  notifyUrl?: string;
  expiryDays?: number;
}

export function createOrder(input: CreateOrderInput) {
  const expiry = new Date(Date.now() + (input.expiryDays || 7) * 24 * 60 * 60 * 1000);
  const meta: Record<string, string> = {};
  // Cashfree accepts only https URLs here, so they are skipped on localhost.
  if (input.returnUrl?.startsWith('https://')) meta.return_url = input.returnUrl;
  if (input.notifyUrl?.startsWith('https://')) meta.notify_url = input.notifyUrl;
  // Checkout shows only these methods. Default "upi" → it opens straight to
  // PhonePe / GPay / Paytm on mobile and a UPI QR on desktop.
  const methods = (process.env.CASHFREE_PAYMENT_METHODS ?? 'upi').trim();
  if (methods) meta.payment_methods = methods;
  return cf('/orders', {
    method: 'POST',
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Number(input.amount.toFixed(2)),
      order_currency: 'INR',
      order_note: input.note.slice(0, 200),
      order_expiry_time: expiry.toISOString(),
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.customerPhone,
        ...(input.customerName ? { customer_name: input.customerName } : {}),
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      },
      ...(Object.keys(meta).length ? { order_meta: meta } : {}),
    }),
  });
}

// ============================================================================
// 🔹 Direct UPI (QR with fixed amount + PhonePe/GPay/Paytm app links).
// Uses Cashfree "Order Pay" (POST /orders/sessions). That needs Cashfree to
// enable "Seamless / S2S Order Pay" on the account; until then this returns
// { available: false } and the screens fall back to the hosted checkout.
// ============================================================================
export interface UpiOptions {
  available: boolean;
  reason?: string;
  upiUrl?: string; // upi://pay?... (QR encodes this; opens any UPI app)
  intents?: Record<string, string>; // phonepe / gpay / paytm / bhim / default
  qrcode?: string; // data:image/png;base64,...
}

export async function getUpiOptions(paymentSessionId: string): Promise<UpiOptions> {
  const pay = (channel: 'link' | 'qrcode') => cf('/orders/sessions', {
    method: 'POST',
    body: JSON.stringify({ payment_session_id: paymentSessionId, payment_method: { upi: { channel } } }),
  });
  try {
    const res: any = await pay('link');
    const payload: Record<string, string> = res?.data?.payload || {};
    const intents: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) if (typeof v === 'string' && v) intents[k] = v;
    let upiUrl = intents.default || Object.values(intents).find((v) => v.startsWith('upi://')) || '';
    let qrcode: string | undefined;
    if (!upiUrl) {
      const q: any = await pay('qrcode');
      const raw = q?.data?.payload?.qrcode;
      if (raw) qrcode = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
    }
    if (!upiUrl && !qrcode) return { available: false, reason: 'Cashfree did not return UPI details' };
    return { available: true, upiUrl, intents, qrcode };
  } catch (e: any) {
    const notEnabled = e.code === 's2s_enabled_not_approved' || /not enabled|not approved/i.test(e.message || '');
    return {
      available: false,
      reason: notEnabled ? 'Direct UPI QR is not enabled on the Cashfree account yet' : (e.message || 'UPI not available'),
    };
  }
}

export const getOrder = (orderId: string) => cf(`/orders/${encodeURIComponent(orderId)}`);
export const getOrderPayments = (orderId: string) => cf<any[]>(`/orders/${encodeURIComponent(orderId)}/payments`);
export const terminateOrder = (orderId: string) =>
  cf(`/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body: JSON.stringify({ order_status: 'TERMINATED' }) });

// ============================================================================
// 🔹 Sync one stored payment with Cashfree. Always re-reads the real status
// from Cashfree, so a forged webhook / page call can never mark it paid.
// When it becomes PAID the first time, the payment is pushed into the lead's
// paymentDetails, so it counts in Received / Balance everywhere in the CRM.
// ============================================================================
export async function syncOnlinePayment(db: Db, linkId: string) {
  const col = db.collection('online_payments');
  const record = await col.findOne({ linkId });
  if (!record) throw Object.assign(new Error('Payment not found'), { status: 404 });

  const order: any = await getOrder(record.orderId || linkId);
  let status: string = order.order_status || record.status;

  let transactions: any[] = record.transactions || [];
  let amountPaid = Number(record.amountPaid || 0);
  if (status === 'PAID' || status === 'ACTIVE') {
    // ACTIVE is checked too: a payment can be SUCCESS a moment before the order flips to PAID.
    try {
      const pays = await getOrderPayments(record.orderId || linkId);
      const ok = (pays || []).filter((p) => p.payment_status === 'SUCCESS').map((p) => ({
        cfPaymentId: String(p.cf_payment_id),
        amount: Number(p.payment_amount || 0),
        method: p.payment_group || '',
        utr: p.bank_reference || '',
        paidAt: p.payment_completion_time || p.payment_time || null,
      }));
      if (ok.length) {
        transactions = ok;
        amountPaid = ok.reduce((s, p) => s + p.amount, 0);
        if (amountPaid >= Number(record.amount) - 0.001) status = 'PAID';
      }
      // Remember the latest failed attempt so staff can see why it didn't go through.
      const lastFail = (pays || []).find((p) => p.payment_status === 'FAILED' || p.payment_status === 'USER_DROPPED');
      if (lastFail && !ok.length) {
        (record as any).lastAttempt = { status: lastFail.payment_status, message: lastFail.payment_message || '', at: lastFail.payment_time || null };
      }
    } catch (e) {
      console.error('Cashfree payments fetch failed (non-fatal):', e);
    }
  }

  const update: Record<string, any> = {
    status, amountPaid, transactions, updatedAt: new Date(), lastVerifiedAt: new Date(),
  };
  if ((record as any).lastAttempt) update.lastAttempt = (record as any).lastAttempt;
  if (status === 'PAID' && !record.paidAt) {
    update.paidAt = transactions[0]?.paidAt ? new Date(transactions[0].paidAt) : new Date();
  }

  // Add to the lead exactly once (atomic flag, so webhook + verify can't double-add).
  if (status === 'PAID' && !record.recordedInLead && record.leadId) {
    const claimed = await col.findOneAndUpdate(
      { linkId, recordedInLead: { $ne: true } },
      { $set: { recordedInLead: true } },
    );
    if (claimed) {
      const tx = transactions[0];
      const paidDate: Date = update.paidAt || record.paidAt || new Date();
      const line = {
        clientType: record.payerType === 'TENANT' ? 'TENANT' : 'OWNER',
        paymentDate: new Date(paidDate.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10), // IST date
        paymentAmount: String(amountPaid || record.amount),
        modeOfPayment: 'ONLINE',
        payerName: record.customerName || '',
        transactionNumber: String(tx?.utr || tx?.cfPaymentId || linkId).slice(0, 30),
        onlineLinkId: linkId,
      };
      try {
        const lead = await db.collection('leads').findOne(
          { _id: new ObjectId(record.leadId) },
          { projection: { paymentDetails: 1 } },
        );
        if (lead) {
          const existing: any[] = Array.isArray(lead.paymentDetails) ? lead.paymentDetails : [];
          const dup = existing.some((p) => p?.onlineLinkId === linkId || (p?.transactionNumber && p.transactionNumber === line.transactionNumber));
          if (!dup) {
            await db.collection('leads').updateOne(
              { _id: new ObjectId(record.leadId) },
              { $push: { paymentDetails: line } as any, $set: { updatedAt: new Date() } },
            );
          }
        }
        update.recordedLine = line;
      } catch (e) {
        await col.updateOne({ linkId }, { $set: { recordedInLead: false } }); // retry on next verify
        throw e;
      }
    }
  }

  await col.updateOne({ linkId }, { $set: update });
  return { record: serialize(await col.findOne({ linkId })) };
}

/** Strip Mongo _id and the checkout session (never needed by CRM screens). */
export function serialize(doc: any) {
  if (!doc) return doc;
  const { _id, paymentSessionId, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}
