'use client';
// ============================================================================
// 🔹 Online Payment (Cashfree) panel for the lead Payment Details tab.
// Enter amount → generate payment link + QR → share with the customer →
// status is checked automatically (and with the Verify button). Once paid, the
// payment is saved to the lead as an ONLINE payment line.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Loader2, Link2, QrCode, Copy, Check, RefreshCw, XCircle, Download, MessageCircle, Wallet, ExternalLink,
} from 'lucide-react';
import { useApi } from '@/components/api-client';

export interface OnlinePaymentLine {
  clientType: 'OWNER' | 'TENANT';
  paymentDate: string;
  paymentAmount: string;
  modeOfPayment: string;
  payerName: string;
  transactionNumber: string;
  onlineLinkId?: string;
}

interface Party { name?: string; phone?: string; email?: string }

interface OnlinePayment {
  id: string;
  linkId: string;
  linkUrl: string;
  amount: number;
  amountPaid: number;
  status: string;
  payerType: 'OWNER' | 'TENANT';
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  purpose: string;
  createdAt: string;
  paidAt?: string;
  expiresAt?: string;
  createdByUserName?: string;
  transactions?: { cfPaymentId: string; amount: number; method: string; utr: string; paidAt: string }[];
  recordedInLead?: boolean;
  recordedLine?: OnlinePaymentLine;
  kind?: 'link';
  lastAttempt?: { status: string; message?: string; at?: string | null };
}

interface Props {
  leadId?: string;
  tokenNo?: string;
  owner?: Party;
  tenant?: Party;
  /** Suggested amount (usually the current balance). */
  suggestedAmount?: number;
  /** Called with every verified online payment line so the form can show / keep it. */
  onPaymentsRecorded?: (lines: OnlinePaymentLine[]) => void;
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700 border-green-200',
  ACTIVE: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  TERMINATED: 'bg-red-50 text-red-600 border-red-200',
  TERMINATION_REQUESTED: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid ✓',
  ACTIVE: 'Pending',
  EXPIRED: 'Expired',
  TERMINATED: 'Cancelled',
  TERMINATION_REQUESTED: 'Cancelling',
};

const inr = (n: number) => `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30 disabled:bg-slate-50';
const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

/** Merge verified online lines into a form's owner/tenant rows, skipping ones already present. */
export function mergeOnlineLines<T extends { paymentAmount: string; transactionNumber?: string }>(
  rows: T[], lines: OnlinePaymentLine[], clientType: 'OWNER' | 'TENANT',
): T[] {
  const add = lines.filter((l) => l.clientType === clientType && !rows.some((r) => r.transactionNumber && r.transactionNumber === l.transactionNumber));
  if (!add.length) return rows;
  const mapped = add.map((l) => ({
    paymentDate: l.paymentDate, paymentAmount: l.paymentAmount, modeOfPayment: 'ONLINE',
    payerName: l.payerName, transactionNumber: l.transactionNumber,
  })) as unknown as T[];
  // Replace the blank placeholder row instead of leaving it above the new line.
  const kept = rows.filter((r) => r.paymentAmount || r.transactionNumber);
  return [...kept, ...mapped];
}

function QrImage({ url, size = 180 }: { url: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => setSrc(''));
    return () => { alive = false; };
  }, [url, size]);
  if (!src) return <div style={{ width: size, height: size }} className="flex items-center justify-center bg-slate-50 rounded-lg"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="Payment QR code" className="rounded-lg border border-slate-200 bg-white" />;
}

export default function OnlinePaymentPanel({ leadId, tokenNo, owner, tenant, suggestedAmount, onPaymentsRecorded }: Props) {
  const { apiFetch } = useApi();
  const [list, setList] = useState<OnlinePayment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<OnlinePayment | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [payerType, setPayerType] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const touched = useRef(false);

  // Prefill payer details from the agreement owner/tenant.
  const party = payerType === 'TENANT' ? tenant : owner;
  useEffect(() => {
    if (touched.current) return;
    setName(party?.name || '');
    setPhone((party?.phone || '').replace(/\D/g, '').slice(-10));
    setEmail(party?.email || '');
  }, [party?.name, party?.phone, party?.email]);

  useEffect(() => {
    if (!amount && suggestedAmount && suggestedAmount > 0) setAmount(String(Math.round(suggestedAmount * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAmount]);

  const onRecordedRef = useRef(onPaymentsRecorded);
  onRecordedRef.current = onPaymentsRecorded;
  const reportLines = useCallback((rows: OnlinePayment[]) => {
    const lines = rows.filter((r) => r.status === 'PAID' && r.recordedLine).map((r) => r.recordedLine as OnlinePaymentLine);
    if (lines.length) onRecordedRef.current?.(lines);
  }, []);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoadingList(true);
    try {
      const res = await apiFetch(`/api/online-payments?leadId=${encodeURIComponent(leadId)}`);
      if (!res.ok) throw new Error('Failed to load online payments');
      const data = await res.json();
      setConfigured(data.configured !== false);
      setList(data.payments || []);
      reportLines(data.payments || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, [leadId, apiFetch, reportLines]);

  useEffect(() => { load(); }, [load]);

  const upsert = useCallback((rec: OnlinePayment) => {
    setList((prev) => {
      const i = prev.findIndex((p) => p.linkId === rec.linkId);
      if (i === -1) return [rec, ...prev];
      const next = [...prev]; next[i] = rec; return next;
    });
    setSelected((s) => (s && s.linkId === rec.linkId ? rec : s));
  }, []);

  const verify = useCallback(async (linkId: string, silent = false) => {
    if (!silent) { setBusyId(linkId); setError(null); setNotice(null); }
    try {
      const res = await apiFetch(`/api/online-payments/${encodeURIComponent(linkId)}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      const rec: OnlinePayment = data.record;
      const before = list.find((p) => p.linkId === linkId)?.status;
      upsert(rec);
      if (rec.status === 'PAID' && rec.recordedLine) onRecordedRef.current?.([rec.recordedLine]);
      if (rec.status === 'PAID' && before !== 'PAID') setNotice(`Payment received: ${inr(rec.amountPaid || rec.amount)} from ${rec.customerName || rec.customerPhone}. Added to ${rec.payerType === 'TENANT' ? 'Tenant' : 'Owner'} payments.`);
      else if (!silent) setNotice(`Status: ${STATUS_LABEL[rec.status] || rec.status}`);
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setBusyId(null);
    }
  }, [apiFetch, list, upsert]);

  // Auto-check pending links every 15 seconds while this tab is open.
  const pendingIds = useMemo(() => list.filter((p) => p.status === 'ACTIVE').map((p) => p.linkId).join(','), [list]);
  const verifyRef = useRef(verify);
  verifyRef.current = verify;
  useEffect(() => {
    if (!pendingIds) return;
    const ids = pendingIds.split(',');
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      ids.forEach((id) => verifyRef.current(id, true));
    }, 15000);
    return () => clearInterval(t);
  }, [pendingIds]);

  const create = async () => {
    setError(null); setNotice(null);
    const amt = parseFloat(amount);
    if (!leadId) { setError('Please save the lead first, then generate the payment link.'); return; }
    if (!amt || amt < 1) { setError('Enter an amount of at least ₹1.'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit mobile number for the payer.'); return; }
    setCreating(true);
    try {
      const res = await apiFetch('/api/online-payments', {
        method: 'POST',
        body: JSON.stringify({
          leadId, tokenNo, payerType, customerName: name, customerPhone: phone, customerEmail: email,
          amount: amt, purpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link');
      upsert(data);
      setSelected(data);
      setNotice('Payment link & QR generated. Share it with the customer.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const cancel = async (linkId: string) => {
    if (!confirm('Cancel this payment link? The customer will no longer be able to pay with it.')) return;
    setBusyId(linkId); setError(null); setNotice(null);
    try {
      const res = await apiFetch(`/api/online-payments/${encodeURIComponent(linkId)}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.record) upsert(data.record);
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setNotice('Link cancelled.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(key); setTimeout(() => setCopied(null), 1500);
  };

  const shareText = (p: OnlinePayment) =>
    `Namaste ${p.customerName || ''}, please pay ${inr(p.amount)} to LegalWings${tokenNo ? ` (Token ${tokenNo})` : ''} using this secure link: ${p.linkUrl}`;

  const whatsapp = (p: OnlinePayment) => {
    window.open(`https://wa.me/91${p.customerPhone}?text=${encodeURIComponent(shareText(p))}`, '_blank', 'noopener');
  };

  const downloadQr = async (p: OnlinePayment) => {
    const u = upi && upi.linkId === p.linkId && upi.available ? upi : null;
    const d = u?.upiUrl ? await QRCode.toDataURL(u.upiUrl, { width: 600, margin: 2 })
      : u?.qrcode ? u.qrcode
      : await QRCode.toDataURL(p.linkUrl, { width: 600, margin: 2 });
    const a = document.createElement('a'); a.href = d; a.download = `payment-qr-${p.linkId}.png`; a.click();
  };

  // Direct UPI QR (fixed amount, scan in PhonePe/GPay → pay) for the selected pending payment.
  const [upi, setUpi] = useState<{ linkId: string; loading: boolean; available?: boolean; upiUrl?: string; qrcode?: string; reason?: string } | null>(null);
  const selectedId = selected?.linkId;
  const selectedActive = selected?.status === 'ACTIVE';
  useEffect(() => {
    if (!selectedId || !selectedActive) { setUpi(null); return; }
    let alive = true;
    setUpi({ linkId: selectedId, loading: true });
    apiFetch(`/api/online-payments/${encodeURIComponent(selectedId)}/upi`)
      .then((r) => r.json())
      .then((d) => { if (alive) setUpi({ linkId: selectedId, loading: false, ...d }); })
      .catch(() => { if (alive) setUpi({ linkId: selectedId, loading: false, available: false }); });
    return () => { alive = false; };
  }, [selectedId, selectedActive, apiFetch]);

  const totals = useMemo(() => ({
    paid: list.filter((p) => p.status === 'PAID').reduce((s, p) => s + (p.amountPaid || p.amount), 0),
    pending: list.filter((p) => p.status === 'ACTIVE').reduce((s, p) => s + p.amount, 0),
  }), [list]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#00843d]" /> Online Payment (Link / QR)
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">Paid online: <b>{inr(totals.paid)}</b></span>
          <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">Pending: <b>{inr(totals.pending)}</b></span>
          <button type="button" onClick={load} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!configured && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          Cashfree keys are not configured on the server (CASHFREE_APP_ID / CASHFREE_SECRET_KEY).
        </div>
      )}
      {!leadId && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Save the lead first to generate an online payment link.
        </div>
      )}

      {/* Generate form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Payer</label>
          <select value={payerType} onChange={(e) => { touched.current = false; setPayerType(e.target.value as any); }} className={`${inputCls} cursor-pointer`}>
            <option value="OWNER">Owner</option>
            <option value="TENANT">Tenant</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Payer Name</label>
          <input className={inputCls} value={name} onChange={(e) => { touched.current = true; setName(e.target.value); }} placeholder="Name" />
        </div>
        <div>
          <label className={labelCls}>Mobile Number <span className="text-red-500">*</span></label>
          <input className={inputCls} value={phone} inputMode="numeric" maxLength={10} onChange={(e) => { touched.current = true; setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); }} placeholder="10-digit mobile" />
        </div>
        <div>
          <label className={labelCls}>Email (optional)</label>
          <input className={inputCls} value={email} onChange={(e) => { touched.current = true; setEmail(e.target.value.trim()); }} placeholder="email@example.com" />
        </div>
        <div>
          <label className={labelCls}>Amount (₹) <span className="text-red-500">*</span></label>
          <input className={inputCls} value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g., 2500" />
          {suggestedAmount && suggestedAmount > 0 ? (
            <button type="button" onClick={() => setAmount(String(Math.round(suggestedAmount * 100) / 100))} className="text-xs text-[#00843d] mt-1 hover:underline">
              Use balance {inr(suggestedAmount)}
            </button>
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Purpose / Note</label>
          <input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., Rent agreement fees" maxLength={200} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="text-xs text-slate-500">Customer pays by UPI (PhonePe / GPay / Paytm / any UPI app). Valid for 7 days.</p>
        <button
          type="button" onClick={create} disabled={creating || !leadId || !configured}
          className="px-5 py-2.5 bg-[#00843d] hover:bg-[#00622d] disabled:opacity-60 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
          Generate Link & QR
        </button>
      </div>

      {error && <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{notice}</div>}

      {/* Selected link: QR + share */}
      {selected && (
        <div className="mt-5 p-4 rounded-xl border border-[#00843d]/30 bg-[#f0fdf4] flex flex-col md:flex-row gap-5 items-center md:items-start">
          <div className="flex flex-col items-center gap-1.5 w-[200px] shrink-0">
            {selected.status === 'ACTIVE' && upi?.loading ? (
              <div style={{ width: 180, height: 180 }} className="flex items-center justify-center bg-white rounded-lg border border-slate-200"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : selected.status === 'ACTIVE' && upi?.available && (upi.upiUrl || upi.qrcode) ? (
              <>
                {upi.upiUrl ? <QrImage url={upi.upiUrl} /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={upi.qrcode} width={180} height={180} alt="UPI QR code" className="rounded-lg border border-slate-200 bg-white" />
                )}
                <p className="text-xs text-center text-green-700 font-medium">UPI QR: scan in PhonePe / GPay / Paytm. Pays {inr(selected.amount)} directly.</p>
              </>
            ) : (
              <>
                <QrImage url={selected.linkUrl} />
                <p className="text-xs text-center text-slate-500">
                  {selected.kind === 'link'
                    ? `Scan with the phone camera (or tap the link on the phone) to pay ${inr(selected.amount)} by UPI.`
                    : 'Scan opens the payment page (UPI apps).'}
                </p>
                {selected.kind !== 'link' && selected.status === 'ACTIVE' && upi && !upi.available && (
                  <p className="text-[11px] text-center text-amber-700">Direct UPI QR will appear here once Cashfree enables it on your account.</p>
                )}
              </>
            )}
          </div>
          <div className="flex-1 min-w-0 w-full space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold text-slate-800">{inr(selected.amount)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[selected.status] || STATUS_STYLE.EXPIRED}`}>{STATUS_LABEL[selected.status] || selected.status}</span>
            </div>
            <p className="text-sm text-slate-600">{selected.payerType === 'TENANT' ? 'Tenant' : 'Owner'}: {selected.customerName || '—'} · {selected.customerPhone}</p>
            <div className="flex items-center gap-2">
              <input readOnly value={selected.linkUrl} className={`${inputCls} bg-white font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => copy(selected.linkUrl, 'sel')} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" title="Copy link">
                {copied === 'sel' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => whatsapp(selected)} className="px-3 py-2 text-sm rounded-lg bg-[#25D366] text-white hover:opacity-90 flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
              <button type="button" onClick={() => copy(shareText(selected), 'msg')} className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5">{copied === 'msg' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />} Copy message</button>
              <button type="button" onClick={() => downloadQr(selected)} className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-4 h-4" /> Download QR</button>
              <a href={selected.linkUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><ExternalLink className="w-4 h-4" /> Open</a>
              <button type="button" onClick={() => verify(selected.linkId)} disabled={busyId === selected.linkId} className="px-3 py-2 text-sm rounded-lg bg-[#00843d] text-white hover:bg-[#00622d] disabled:opacity-60 flex items-center gap-1.5">
                {busyId === selected.linkId ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verify Payment
              </button>
            </div>
            {selected.status === 'ACTIVE' && selected.lastAttempt && <p className="text-xs text-red-600">Customer&apos;s last attempt failed{selected.lastAttempt.message ? `: ${selected.lastAttempt.message}` : ''}. They can open the same link again.</p>}
            {selected.status === 'ACTIVE' && <p className="text-xs text-slate-500">Status is checked automatically every 15 seconds while this page is open.</p>}
          </div>
        </div>
      )}

      {/* History */}
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Online payment records</h4>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">{loadingList ? 'Loading…' : 'No online payment links yet.'}</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Created</th>
                  <th className="text-left px-3 py-2 font-medium">Payer</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-right px-3 py-2 font-medium">Paid</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Txn / UTR</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const tx = p.transactions?.[0];
                  return (
                    <tr key={p.linkId} className="border-t border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(p.createdAt)}<div className="text-xs text-slate-400">{p.createdByUserName}</div></td>
                      <td className="px-3 py-2">{p.customerName || '—'}<div className="text-xs text-slate-400">{p.payerType === 'TENANT' ? 'Tenant' : 'Owner'} · {p.customerPhone}</div></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{inr(p.amount)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-[#00843d]">{p.amountPaid ? inr(p.amountPaid) : '—'}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[p.status] || STATUS_STYLE.EXPIRED}`}>{STATUS_LABEL[p.status] || p.status}</span>
                        {p.paidAt && <div className="text-xs text-slate-400 mt-0.5">{fmtDateTime(p.paidAt)}</div>}
                        {p.status === 'ACTIVE' && p.lastAttempt && <div className="text-xs text-red-500 mt-0.5" title={p.lastAttempt.message || ''}>Last attempt failed</div>}</td>
                      <td className="px-3 py-2 text-xs font-mono">{tx ? <>{tx.utr || tx.cfPaymentId}<div className="text-slate-400 font-sans">{tx.method}</div></> : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button type="button" title="Show QR & share" onClick={() => setSelected(p)} className="p-1.5 rounded-md hover:bg-slate-100"><QrCode className="w-4 h-4" /></button>
                          <button type="button" title="Copy link" onClick={() => copy(p.linkUrl, p.linkId)} className="p-1.5 rounded-md hover:bg-slate-100">{copied === p.linkId ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}</button>
                          <button type="button" title="Verify payment" onClick={() => verify(p.linkId)} disabled={busyId === p.linkId} className="p-1.5 rounded-md hover:bg-slate-100">{busyId === p.linkId ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</button>
                          {p.status === 'ACTIVE' && (
                            <button type="button" title="Cancel link" onClick={() => cancel(p.linkId)} disabled={busyId === p.linkId} className="p-1.5 rounded-md hover:bg-red-50 text-red-500"><XCircle className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
