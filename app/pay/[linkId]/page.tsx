'use client';
// Public payment page the customer opens from the shared link / QR.
// Payment links: sends the customer to Cashfree's link (UPI app on phones) and,
// after paying, shows the verified status with a "Try again" option.
// Older records: opens Cashfree's checkout / direct UPI as before.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';

interface PayInfo {
  amount: number;
  amountPaid: number;
  status: string;
  customerName: string;
  purpose: string;
  tokenNo: string;
  expiresAt: string | null;
  paidAt: string | null;
  reference: string;
  lastAttempt: string | null;
  mode?: 'production' | 'sandbox';
  paymentSessionId?: string | null;
  checkoutUrl?: string | null; // Cashfree payment link (opens the UPI app on phones)
}

declare global {
  interface Window { Cashfree?: (opts: { mode: string }) => { checkout: (o: any) => Promise<any> } }
}

const SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`) as HTMLScriptElement | null;
    const s = existing || document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment gateway. Check your internet and try again.'));
    if (!existing) document.body.appendChild(s);
  });
}

export default function PayPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const search = useSearchParams();
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(linkId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment link not found');
      setInfo(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, [linkId]);

  // Re-check status a few times right after checkout (bank confirmation can take a moment).
  const checkStatus = useCallback(async () => {
    setChecking(true);
    let tries = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = async () => {
      tries++;
      try {
        const res = await fetch(`/api/public/pay/${encodeURIComponent(linkId)}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) setInfo((prev) => ({ ...(prev as PayInfo), ...data }));
        if (data.status !== 'ACTIVE' || tries >= 10) {
          if (pollRef.current) clearInterval(pollRef.current);
          setChecking(false);
          if (data.status !== 'ACTIVE') load();
        }
      } catch {
        if (tries >= 10 && pollRef.current) { clearInterval(pollRef.current); setChecking(false); }
      }
    };
    await tick();
    pollRef.current = setInterval(tick, 3000);
  }, [linkId, load]);

  useEffect(() => {
    load();
    if (search.get('done')) checkStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // ---- Direct UPI (app buttons + QR), when Cashfree has it enabled ----
  const [upi, setUpi] = useState<{ available: boolean; upiUrl?: string; intents?: Record<string, string>; qrcode?: string } | null>(null);
  const [upiQr, setUpiQr] = useState('');
  const autoTried = useRef(false);
  const isActive = info?.status === 'ACTIVE';
  const isLink = !!info?.checkoutUrl;
  const returned = !!search.get('done');

  // Payment link: go straight to Cashfree's link (not when coming back from it).
  const linkOpened = useRef(false);
  useEffect(() => {
    if (!isActive || !info?.checkoutUrl || returned || linkOpened.current) return;
    linkOpened.current = true;
    window.location.replace(info.checkoutUrl);
  }, [isActive, info?.checkoutUrl, returned]);
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isActive || upi || isLink) return;
    fetch(`/api/public/pay/${encodeURIComponent(linkId)}/upi`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setUpi(d?.available ? d : { available: false }))
      .catch(() => setUpi({ available: false }));
  }, [isActive, upi, linkId, isLink]);

  useEffect(() => {
    if (!upi?.available) return;
    if (upi.upiUrl) {
      import('qrcode').then((Q) => Q.toDataURL(upi.upiUrl as string, { width: 440, margin: 1 })).then(setUpiQr).catch(() => {});
    } else if (upi.qrcode) setUpiQr(upi.qrcode);
  }, [upi]);

  // Open the payment straight away: UPI app on mobile, or Cashfree UPI checkout as fallback.
  useEffect(() => {
    if (!isActive || !upi || autoTried.current || search.get('done')) return;
    autoTried.current = true;
    if (upi.available) {
      if (isMobile && /Android/i.test(navigator.userAgent) && upi.upiUrl) window.location.href = upi.upiUrl;
    } else {
      pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, upi]);

  // While the customer pays in their UPI app, keep checking (and right when they come back).
  useEffect(() => {
    if (!isActive || !(upi?.available || (isLink && returned))) return;
    const quick = async () => {
      try {
        const res = await fetch(`/api/public/pay/${encodeURIComponent(linkId)}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status !== 'ACTIVE') setInfo((prev) => ({ ...(prev as PayInfo), ...data }));
      } catch { /* try again next tick */ }
    };
    const t = setInterval(() => { if (document.visibilityState === 'visible') quick(); }, 5000);
    const onVis = () => { if (document.visibilityState === 'visible') quick(); };
    document.addEventListener('visibilitychange', onVis);
    const stop = setTimeout(() => clearInterval(t), 15 * 60 * 1000);
    return () => { clearInterval(t); clearTimeout(stop); document.removeEventListener('visibilitychange', onVis); };
  }, [isActive, upi, linkId, isLink, returned]);

  const APPS: { key: string; label: string; color: string }[] = [
    { key: 'phonepe', label: 'PhonePe', color: '#5f259f' },
    { key: 'gpay', label: 'Google Pay', color: '#1a73e8' },
    { key: 'paytm', label: 'Paytm', color: '#00baf2' },
    { key: 'bhim', label: 'BHIM', color: '#f37021' },
  ];

  const pay = async () => {
    if (!info?.paymentSessionId) return;
    setError(null);
    setPaying(true);
    try {
      await loadSdk();
      const cashfree = window.Cashfree!({ mode: info.mode || 'production' });
      const result = await cashfree.checkout({ paymentSessionId: info.paymentSessionId, redirectTarget: '_modal' });
      if (result?.error) setError(result.error.message || 'Payment was not completed. You can try again.');
      await checkStatus();
    } catch (e: any) {
      setError(e.message || 'Could not open payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const status = info?.status;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f0fdf4] to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-[#00843d] text-white px-6 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={40} height={40} className="rounded-lg bg-white p-1" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">LegalWings</h1>
              <p className="text-xs text-green-100">Secure online payment</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!info && !error && (
            <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>
          )}

          {!info && error && (
            <div className="text-center py-10">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-slate-700 font-medium">{error}</p>
            </div>
          )}

          {info && (
            <>
              <div className="text-center mb-6">
                {info.customerName && <p className="text-sm text-slate-500 mb-1">Hello {info.customerName}, amount to pay</p>}
                <p className="text-4xl font-bold text-slate-800">{inr(info.amount)}</p>
                {info.purpose && <p className="text-sm text-slate-600 mt-2">{info.purpose}</p>}
                {info.tokenNo && <p className="text-xs text-slate-400 mt-1">Token No. {info.tokenNo}</p>}
              </div>

              {status === 'PAID' && (
                <div className="text-center p-5 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-2" />
                  <p className="text-lg font-semibold text-green-700">Payment successful</p>
                  <p className="text-sm text-green-800 mt-1">{inr(info.amountPaid || info.amount)} received. Thank you!</p>
                  {info.reference && <p className="text-xs text-slate-500 mt-2">Reference: <span className="font-mono">{info.reference}</span></p>}
                </div>
              )}

              {status === 'ACTIVE' && isLink && (
                <div className="space-y-3">
                  {checking ? (
                    <div className="flex items-center justify-center py-3 text-slate-600 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking payment with the bank…</div>
                  ) : returned || info.lastAttempt ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 text-center">
                      Payment is not completed yet. If money was already debited, this page will update by itself in a few minutes — please don&apos;t pay twice.
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-3 text-slate-500 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Opening your UPI app…</div>
                  )}
                  <a href={info.checkoutUrl as string}
                    className={`block w-full py-3.5 rounded-xl bg-[#00843d] hover:bg-[#00622d] text-white font-semibold text-base text-center shadow-sm ${checking ? 'pointer-events-none opacity-60' : ''}`}>
                    {returned || info.lastAttempt ? 'Try again' : `Pay ${inr(info.amount)}`}
                  </a>
                  <p className="text-xs text-center text-slate-500">PhonePe · Google Pay · Paytm · any UPI app</p>
                  {returned && !checking && (
                    <button type="button" onClick={checkStatus} className="block mx-auto text-xs text-[#00843d] hover:underline">I have paid — check again</button>
                  )}
                </div>
              )}

              {status === 'ACTIVE' && !isLink && !upi && (
                <div className="flex items-center justify-center py-6 text-slate-500 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Opening payment…</div>
              )}

              {status === 'ACTIVE' && upi?.available && (
                <div className="space-y-3">
                  {isMobile && (
                    <div className="grid grid-cols-2 gap-2">
                      {APPS.filter((a) => upi.intents?.[a.key]).map((a) => (
                        <a key={a.key} href={upi.intents![a.key]} style={{ backgroundColor: a.color }}
                          className="py-3 rounded-xl text-white font-semibold text-sm text-center shadow-sm hover:opacity-90">
                          {a.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {upi.upiUrl && (
                    <a href={upi.upiUrl} className="block w-full py-3.5 rounded-xl bg-[#00843d] hover:bg-[#00622d] text-white font-semibold text-base text-center shadow-sm">
                      Pay {inr(info.amount)} with any UPI app
                    </a>
                  )}
                  {(!isMobile || !upi.upiUrl) && upiQr && (
                    <div className="flex flex-col items-center pt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={upiQr} width={220} height={220} alt="UPI QR code" className="rounded-lg border border-slate-200" />
                      <p className="text-xs text-slate-500 mt-2">Scan with PhonePe, Google Pay, Paytm or any UPI app</p>
                    </div>
                  )}
                  <p className="text-xs text-center text-slate-500">After paying, come back here. This page updates automatically.</p>
                </div>
              )}

              {status === 'ACTIVE' && upi && !upi.available && (
                <>
                  <button
                    onClick={pay} disabled={paying || checking || !info.paymentSessionId}
                    className="w-full py-3.5 rounded-xl bg-[#00843d] hover:bg-[#00622d] disabled:opacity-60 text-white font-semibold text-base flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    {paying || checking ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {checking ? 'Checking payment…' : `Pay ${inr(info.amount)}`}
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-3">PhonePe · Google Pay · Paytm · any UPI app</p>
                  {info.lastAttempt && !checking && <p className="text-xs text-center text-amber-600 mt-2">The last attempt did not go through. Please try again.</p>}
                </>
              )}

              {(status === 'EXPIRED' || status === 'TERMINATED' || status === 'TERMINATION_REQUESTED') && (
                <div className="text-center p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <Clock className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">This payment link is {status === 'EXPIRED' ? 'expired' : 'no longer active'}</p>
                  <p className="text-sm text-slate-500 mt-1">Please contact LegalWings for a new link.</p>
                </div>
              )}

              {error && <p className="mt-4 text-sm text-center text-red-600">{error}</p>}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4" /> Payments are processed securely by Cashfree Payments
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
