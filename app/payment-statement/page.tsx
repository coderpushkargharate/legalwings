'use client';

// ============================================================================
// 🔹 PANEL: Payment Statement (date-wise)
// Pulls every recorded payment from the shared /api/leads API, flattens each
// lead's paymentDetails into one row per payment (newest date on top) and
// exports to Excel.
//
// Columns: Payment Date · Lead Date · Appointment Date · Token Number · Lead No · Lead Name ·
//          Phone · Payer Name · Mode · Transaction ID · Amount ·
//          Collector / Receiver (editable) · Executive Name · Verify (Yes/No).
//
// "Collector / Receiver" and "Verify" are edited inline and saved back onto the
// lead's paymentDetails via PATCH /api/leads (new per-payment fields).
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, RefreshCw, FileText, Wallet, Check, X as XIcon, IndianRupee, ChevronLeft, ChevronRight, TrendingDown, Scale } from 'lucide-react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import BillingPanel from '@/components/billing-panel';
import ExpensesPanel from '@/components/expenses-panel';
import PnlPanel from '@/components/pnl-panel';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import { balanceDueOf } from '@/lib/payment-math';
import { CASH_RECEIVERS, CASH_VERIFIERS } from '@/lib/cash-staff';

// ---------------------------------------------------------------------------
// Types (kept local & minimal — only the fields this panel reads)
// ---------------------------------------------------------------------------
interface PaymentDetail {
  clientType?: 'OWNER' | 'TENANT';
  paymentDate?: string;
  paymentAmount?: string;
  modeOfPayment?: string;
  payerName?: string;
  transactionNumber?: string;
  // Editable, persisted per-payment fields added by this panel.
  collectorReceiver?: string;
  verified?: boolean;
  verifiedBy?: string; // CASH: Tejas / Anuja (picked in this statement); ONLINE: 'Cashfree'
  onlineLinkId?: string; // set when the line was added automatically after a Cashfree payment
  cfPaymentId?: string;
}

// Cashfree data for a PAID online-payment link (from GET /api/online-payments?paid=1).
interface CashfreePaid {
  linkId: string;
  leadId: string;
  amount: number;
  utr: string;
  cfPaymentId: string;
}
// Lookups used to tie a statement line to its Cashfree payment.
interface CashfreeIndex {
  byLink: Map<string, CashfreePaid>;
  byTxn: Map<string, CashfreePaid>; // UTR and Cashfree payment id
  byLeadAmount: Map<string, CashfreePaid[]>; // `${leadId}|${amount}`
}
interface Person {
  firstName?: string;
  lastName?: string;
}
interface Lead {
  id: string;
  client?: { firstName?: string; lastName?: string; phoneNo?: string };
  agreement?: { tokenNo?: string; owner?: Person; tenant?: Person };
  leadDate?: string;
  createdDate?: string;
  appointmentTime?: string;
  assignedToUserName?: string | null;
  createdByUserName?: string | null;
  // Commission expense fields (read by the Expenses tab) + the amount fields
  // (totalAmount = Legal Fees / outstanding) used to compute the pending balance.
  payment?: {
    commissionName?: string;
    commissionAmount?: number | string;
    commissionDate?: string;
    totalAmount?: number | string;
    outstandingAmount?: number | string;
    pendingAmount?: number | string;
    balanceAmount?: number | string;
    expenseVerified?: boolean; // Expenses tab "Verify"
  };
  paymentDetails?: PaymentDetail[];
  forwardedHistory?: Array<{
    fromTeam?: string;
    toTeam?: string;
    forwardedBy?: string;
    forwardedAt?: string;
  }>;
}

// One flattened statement row = one payment.
interface StatementRow {
  leadId: string;
  paymentIndex: number; // index within the lead's paymentDetails (for saving)
  date: string; // raw payment date used for sorting/today totals
  leadDate: string;
  appointmentDate: string;
  tokenNo: string;
  leadName: string;
  ownerName: string;
  tenantName: string;
  payerName: string;
  mode: string;
  transactionNumber: string;
  amount: number;
  collectorReceiver: string;
  executiveName: string;
  verified: boolean;
  verifiedBy: string;
  cashfreeConfirmed: boolean; // matched to a PAID Cashfree payment
  autoVerified: boolean; // verified by Cashfree itself (not changed by hand)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toNum = (v?: number | string | null): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const dateValue = (d?: string): number => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
};

const formatDate = (d?: string): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatINR = (v?: number | string | null): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(toNum(v));

const leadName = (lead: Lead): string =>
  `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-';

const personName = (p?: Person): string =>
  `${p?.firstName || ''} ${p?.lastName || ''}`.trim() || '-';

// The executive who actually worked the lead (and collected/received the payment).
// The executive team collects payments, but once a lead is forwarded on to the Backend
// team `assignedToUserName` becomes the BACKEND employee — which is NOT who we want here.
// So we read the most recent forwardedHistory entry whose fromTeam is the Executive team
// (i.e. the executive who forwarded it onward). If the lead never left the Executive team
// (or was never in it) we fall back to the assigned user, then the creator — never blank.
const executiveFor = (lead: Lead): string => {
  const hist = lead.forwardedHistory || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const h = hist[i];
    if (h?.fromTeam === 'EXECUTIVE_TEAM' && h.forwardedBy) return h.forwardedBy;
  }
  return lead.assignedToUserName || lead.createdByUserName || '-';
};

// Normalised Cash / Online label for the "Mode" column.
const modeLabel = (mode?: string): string => (isOnlineMode(mode) ? 'Online' : 'Cash');

// Collector / Receiver value shown in the statement — uses the saved value if the
// user edited it, otherwise auto-fills from the executive so the column is never blank.
const effectiveCollector = (r: StatementRow): string =>
  canonicalReceiver(r.collectorReceiver || (r.executiveName && r.executiveName !== '-' ? r.executiveName : ''));

// Map a name onto the CASH_RECEIVERS spelling so one person never shows twice
// (e.g. executive "Tejas Patil" / "tejas" → "Tejas"). Exact match (any case) first,
// then a unique first-name match; otherwise the name is kept as it is.
const canonicalReceiver = (name?: string): string => {
  const n = (name || '').trim();
  if (!n) return '';
  const lower = n.toLowerCase();
  const exact = CASH_RECEIVERS.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;
  const first = lower.split(/\s+/)[0];
  const byFirst = CASH_RECEIVERS.filter((r) => r.toLowerCase().split(/\s+/)[0] === first);
  return byFirst.length === 1 ? byFirst[0] : n;
};

// Page numbers to render in the pagination bar (0-based; -1 = ellipsis gap).
// Keeps first, last, current and one neighbour each side for direct jumping.
const buildPageList = (current: number, total: number): number[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const wanted = Array.from(new Set([0, total - 1, current, current - 1, current + 1]))
    .filter((p) => p >= 0 && p < total)
    .sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < wanted.length; i++) {
    if (i > 0 && wanted[i] - wanted[i - 1] > 1) out.push(-1);
    out.push(wanted[i]);
  }
  return out;
};

const ROWS_PER_PAGE = 20;

// Local YYYY-MM-DD "today" (avoids UTC shifting the day).
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Online = any recorded mode that isn't cash (UPI / bank transfer / card / cheque…).
const isOnlineMode = (mode?: string): boolean => !!mode && mode !== '-' && !/cash/i.test(mode);

// ---------------------------------------------------------------------------
// Cashfree PAID links → lookup index
// ---------------------------------------------------------------------------
const emptyIndex = (): CashfreeIndex => ({ byLink: new Map(), byTxn: new Map(), byLeadAmount: new Map() });
const leadAmountKey = (leadId: string, amount: number) => `${leadId}|${Math.round(amount * 100)}`;

const buildCashfreeIndex = (payments: any[]): CashfreeIndex => {
  const idx = emptyIndex();
  for (const rec of payments || []) {
    if (!rec?.linkId) continue;
    const txs: any[] = rec.transactions || [];
    const tx = txs.find((t) => t?.utr) || txs[0] || {};
    const cf: CashfreePaid = {
      linkId: rec.linkId,
      leadId: String(rec.leadId || ''),
      amount: toNum(rec.amountPaid),
      utr: tx.utr || '',
      cfPaymentId: tx.cfPaymentId ? String(tx.cfPaymentId) : '',
    };
    idx.byLink.set(cf.linkId, cf);
    for (const t of txs) {
      if (t?.utr) idx.byTxn.set(String(t.utr), cf);
      if (t?.cfPaymentId) idx.byTxn.set(String(t.cfPaymentId), cf);
    }
    if (cf.leadId && cf.amount > 0) {
      const k = leadAmountKey(cf.leadId, cf.amount);
      idx.byLeadAmount.set(k, [...(idx.byLeadAmount.get(k) || []), cf]);
    }
  }
  return idx;
};

// ---------------------------------------------------------------------------
// Flatten leads → statement rows (one row per recorded payment)
// ---------------------------------------------------------------------------
const buildRows = (leads: Lead[], cashfree: CashfreeIndex): StatementRow[] => {
  const rows: StatementRow[] = [];
  const claimed = new Set<string>(); // each Cashfree payment backs at most one line
  for (const lead of leads) {
    const tokenNo = lead.agreement?.tokenNo || '-';
    const name = leadName(lead);
    const ownerName = personName(lead.agreement?.owner);
    const tenantName = personName(lead.agreement?.tenant);
    const leadDate = lead.leadDate || lead.createdDate || '';
    const appointmentDate = lead.appointmentTime || '';
    // Executive = the Executive-team member who worked this lead (see executiveFor).
    // This also auto-fills the Collector / Receiver column via effectiveCollector().
    const executiveName = executiveFor(lead);
    const details = lead.paymentDetails || [];
    details.forEach((p, idx) => {
      const amount = toNum(p.paymentAmount);
      // Only include real payments (has an amount or a date).
      if (amount <= 0 && !p.paymentDate) return;
      // Tie the line to its Cashfree payment: by link id (lines the sync added), else
      // by the typed transaction no. (UTR / Cashfree payment id), else — for an online
      // line on the same lead — by the exact amount when there's only one candidate.
      const online = isOnlineMode(p.modeOfPayment);
      let cf: CashfreePaid | undefined;
      if (online) {
        cf = (p.onlineLinkId && cashfree.byLink.get(p.onlineLinkId))
          || (p.cfPaymentId && cashfree.byTxn.get(String(p.cfPaymentId)))
          || (p.transactionNumber && cashfree.byTxn.get(p.transactionNumber.trim()))
          || undefined;
        if (!cf && amount > 0) {
          const options = (cashfree.byLeadAmount.get(leadAmountKey(lead.id, amount)) || []).filter((c) => !claimed.has(c.linkId));
          if (options.length === 1) cf = options[0];
        }
        if (cf) claimed.add(cf.linkId);
      }
      const cashfreeConfirmed = !!cf || (!!p.onlineLinkId && online);
      // Verified: an explicit Yes/No set by hand wins; otherwise Cashfree-confirmed = verified.
      const verified = p.verified === false ? false : (p.verified === true || cashfreeConfirmed);
      const verifiedBy = verified ? (p.verifiedBy || (cashfreeConfirmed ? 'Cashfree' : '')) : '';
      const autoVerified = cashfreeConfirmed && verified && verifiedBy === 'Cashfree';
      // Transaction no. = Cashfree's real UTR (bank reference) whenever we have it.
      const txn = cf?.utr || p.transactionNumber || cf?.cfPaymentId || p.cfPaymentId || '';
      rows.push({
        leadId: lead.id,
        paymentIndex: idx,
        date: p.paymentDate || '',
        leadDate,
        appointmentDate,
        tokenNo,
        leadName: name,
        ownerName,
        tenantName,
        payerName: p.payerName || '-',
        mode: p.modeOfPayment || '-',
        transactionNumber: txn || '-',
        amount,
        collectorReceiver: p.collectorReceiver || '',
        executiveName,
        verified,
        verifiedBy,
        cashfreeConfirmed,
        autoVerified,
      });
    });
  }
  // Newest date on top, oldest at the bottom.
  return rows.sort((a, b) => dateValue(b.date) - dateValue(a.date));
};

export default function PaymentStatementPage() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [cashfreePaid, setCashfreePaid] = useState<CashfreeIndex>(emptyIndex);
  const [liveNote, setLiveNote] = useState<string | null>(null); // "N new Cashfree payments verified"
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0); // 0-based page for the statement table (20 rows/page)
  // Three views in one page: the date-wise "Statement", the commission "Expenses"
  // tab, and the "Billing" system.
  const [tab, setTab] = useState<'statement' | 'expenses' | 'pnl' | 'billing'>('statement');
  // Statement is split into two: Online payments and Cash payments.
  const [view, setView] = useState<'online' | 'cash'>('online');
  const isCashView = view === 'cash';

  // Fetch ALL leads. First page tells us the total, then the remaining pages are
  // fetched in PARALLEL (instead of one-by-one) so the statement loads much faster.
  const fetchAll = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (authLoading || !user) return;
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const pageSize = 200;
      const pageUrl = (p: number) =>
        `/api/leads?${new URLSearchParams({ transitLevel: 'ALL', viewAll: 'true', page: p.toString(), pageSize: pageSize.toString() })}`;

      // Cashfree PAID links (UTR / payment id) — loaded alongside; non-fatal if it fails.
      const cashfreeReq = apiFetch('/api/online-payments?paid=1')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const firstRes = await apiFetch(pageUrl(0));
      if (!firstRes.ok) throw new Error('Failed to load payments');
      const firstData = await firstRes.json();
      const collected: Lead[] = [...(firstData?.leadPage?.content || [])];
      // Safety cap so a bad totalPages can never fan out forever.
      const totalPages = Math.min(firstData?.leadPage?.totalPages || 1, 100);

      if (totalPages > 1) {
        const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 1);
        const results = await Promise.all(
          restPages.map((p) => apiFetch(pageUrl(p)).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
        );
        for (const data of results) {
          if (data?.leadPage?.content) collected.push(...data.leadPage.content);
        }
      }
      const cfData = await cashfreeReq;
      setCashfreePaid(buildCashfreeIndex(cfData?.payments || []));
      setLeads(collected);
    } catch (err: any) {
      if (!opts.silent) {
        setError(err?.message || 'Failed to load payments');
        setLeads([]);
      }
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [apiFetch, authLoading, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 🔹 Live Cashfree auto-verify: ask the server to re-check every recent unpaid
  // link with Cashfree (on open, then every 20s while this tab is visible). A link
  // that got paid is added to its lead as a verified ONLINE line → reload silently
  // so the row turns green with the real UTR, without waiting for the webhook.
  const syncingRef = useRef(false);
  const syncCashfree = useCallback(async () => {
    if (authLoading || !user || syncingRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    syncingRef.current = true;
    try {
      const res = await apiFetch('/api/online-payments/sync-pending', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setLastChecked(new Date());
      if (data?.paid?.length) {
        await fetchAll({ silent: true });
        setLiveNote(`✅ ${data.paid.length} new Cashfree payment${data.paid.length > 1 ? 's' : ''} received & auto-verified`);
      } else if (data?.checked) {
        // UTRs may have arrived — refresh just the Cashfree list (cheap).
        const r = await apiFetch('/api/online-payments?paid=1');
        if (r.ok) setCashfreePaid(buildCashfreeIndex((await r.json())?.payments || []));
      }
    } catch {
      // network blip — the next tick retries
    } finally {
      syncingRef.current = false;
    }
  }, [apiFetch, authLoading, user, fetchAll]);

  useEffect(() => {
    if (tab !== 'statement') return;
    syncCashfree();
    const t = setInterval(syncCashfree, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') syncCashfree(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [syncCashfree, tab]);

  useEffect(() => {
    if (!liveNote) return;
    const t = setTimeout(() => setLiveNote(null), 8000);
    return () => clearTimeout(t);
  }, [liveNote]);

  // Name saved as "Verified By" when someone verifies an online row by hand.
  const myName = `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || 'Manual';

  // Save an edited per-payment field (Collector/Receiver or Verify) back onto the
  // lead's paymentDetails. Optimistic: update locally first, then PATCH; revert on error.
  const savePaymentField = useCallback(
    async (leadId: string, paymentIndex: number, patch: Partial<PaymentDetail>) => {
      const original = leads.find((l) => l.id === leadId);
      if (!original) return;
      const updatedDetails = (original.paymentDetails || []).map((p, i) =>
        i === paymentIndex ? { ...p, ...patch } : p,
      );
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, paymentDetails: updatedDetails } : l)));
      setSaving(true);
      try {
        const res = await apiFetch('/api/leads', {
          method: 'PATCH',
          body: JSON.stringify({ id: leadId, paymentDetails: updatedDetails }),
        });
        if (!res.ok) throw new Error('save failed');
      } catch {
        // Revert to the pre-edit lead on failure.
        setLeads((prev) => prev.map((l) => (l.id === leadId ? original : l)));
        alert('Failed to save the change. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [leads, apiFetch],
  );

  // Expenses tab Verify toggle — keep the shared leads list in sync (the panel saves it).
  const setExpenseVerified = useCallback((leadId: string, verified: boolean) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, payment: { ...l.payment, expenseVerified: verified } } : l)));
  }, []);

  // All rows (newest first), then apply the optional date-range filter.
  const allRows = useMemo(() => buildRows(leads, cashfreePaid), [leads, cashfreePaid]);
  const rows = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null; // include the whole "to" day
    return allRows.filter((r) => {
      if (isOnlineMode(r.mode) === isCashView) return false; // Online view <-> Cash view
      if (!from && !to) return true;
      const t = dateValue(r.date);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allRows, fromDate, toDate, isCashView]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  // Client-side pagination for the statement table — 20 rows per page.
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  // Snap back into range if the row set shrinks (e.g. after applying a date filter).
  useEffect(() => { setPage(0); }, [fromDate, toDate, view]);
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => rows.slice(safePage * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [rows, safePage],
  );

  // Cash / Online split — "today" totals and all-time ("up to date") totals.
  // Always based on ALL rows (independent of the date-range filter).
  const { todayCash, todayOnline, totalCash, totalOnline } = useMemo(() => {
    const t = todayLocal();
    let tCash = 0, tOnline = 0, aCash = 0, aOnline = 0;
    for (const r of allRows) {
      const online = isOnlineMode(r.mode);
      if (online) aOnline += r.amount; else aCash += r.amount;
      if ((r.date || '').slice(0, 10) === t) {
        if (online) tOnline += r.amount; else tCash += r.amount;
      }
    }
    return { todayCash: tCash, todayOnline: tOnline, totalCash: aCash, totalOnline: aOnline };
  }, [allRows]);
  const todayReceived = todayCash + todayOnline;

  // Cash view: name-wise cash collection (who received the cash).
  // Today Cash = received today; Total Cash = all cash rows in the current date filter.
  const cashByName = useMemo(() => {
    const t = todayLocal();
    const map = new Map<string, { today: number; total: number }>();
    for (const n of CASH_RECEIVERS) map.set(n, { today: 0, total: 0 });
    for (const r of rows) {
      if (isOnlineMode(r.mode)) continue;
      const name = effectiveCollector(r) || 'Unassigned';
      const e = map.get(name) || { today: 0, total: 0 };
      e.total += r.amount;
      if ((r.date || '').slice(0, 10) === t) e.today += r.amount;
      map.set(name, e);
    }
    return Array.from(map, ([name, v]) => ({ name, ...v }));
  }, [rows]);
  const upToDateTotal = totalCash + totalOnline;

  // Pending (outstanding) balance across all leads = Σ (Legal Fees − received)
  // per lead. Legal Fees = payment.totalAmount (== outstanding); received = the
  // sum of that lead's payment lines. Overpaid leads are clamped to 0 so they
  // don't cancel out genuine pending balances on other leads. All-time (ignores
  // the date filter), like the other summary totals.
  const { pendingAmount, todayPending } = useMemo(() => {
    const t = todayLocal();
    let pending = 0, todayP = 0;
    for (const lead of leads) {
      const balance = balanceDueOf(lead);
      if (balance <= 0) continue;
      pending += balance;
      // "Today" pending = balance still owed on leads dated today.
      const leadDate = lead.leadDate || lead.createdDate || '';
      if (leadDate.slice(0, 10) === t) todayP += balance;
    }
    return { pendingAmount: pending, todayPending: todayP };
  }, [leads]);

  // Excel export — same rows & order as shown on screen.
  const handleExport = useCallback(() => {
    const exportData = rows.map((r, i) => ({
      'Sr. No': i + 1,
      'Payment Date': formatDate(r.date),
      'Lead Date': formatDate(r.leadDate),
      'Appointment Date': formatDate(r.appointmentDate),
      'Token No': r.tokenNo,
      'Lead Name': r.leadName,
      'Owner Name': r.ownerName,
      'Tenant Name': r.tenantName,
      'Payer Name': r.payerName,
      'Mode (Cash/Online)': modeLabel(r.mode),
      'Transaction No/Cash': isOnlineMode(r.mode) ? r.transactionNumber : 'Cash',
      Amount: r.amount,
      'Collector / Receiver': effectiveCollector(r) || '-',
      'Executive Name': r.executiveName,
      Verify: r.verified ? 'Yes' : 'No',
      'Verified By': r.verified ? r.verifiedBy || '-' : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isCashView ? 'Cash Statement' : 'Online Statement');
    if (isCashView) {
      const nameWise = cashByName.map((c) => ({ Name: c.name, 'Today Cash': c.today, 'Total Cash': c.total }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nameWise), 'Name-wise Cash');
    }
    const kind = isCashView ? 'Cash' : 'Online';
    XLSX.writeFile(wb, `${kind}_Payment_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [rows, isCashView, cashByName]);

  const th = 'px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm text-slate-700 whitespace-nowrap';
  const COLS = 15;

  return (
    <AppShell>
      <Header title="Payment Statement" />
      <div className="p-6 space-y-4">
        {/* Tabs: date-wise Statement | commission Expenses | Billing system */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {([['statement', 'Statement', FileText], ['expenses', 'Expenses', TrendingDown], ['pnl', 'Net Amount', Scale], ['billing', 'Billing', Wallet]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-md transition-all ${
                tab === key ? 'bg-white text-[#00843d] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === 'billing' ? (
          <BillingPanel />
        ) : tab === 'expenses' ? (
          <ExpensesPanel
            leads={leads}
            loading={loading}
            error={error}
            onRefresh={() => fetchAll()}
            onLeadVerifiedChange={setExpenseVerified}
          />
        ) : tab === 'pnl' ? (
          <PnlPanel leads={leads} loading={loading} error={error} onRefresh={() => fetchAll()} />
        ) : (
        <>
        {/* Online / Cash statement split */}
        <div className="flex gap-2">
          {([['online', 'Online Statement'], ['cash', 'Cash Statement']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg border transition-all ${
                view === key
                  ? key === 'cash' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          🧾 <strong>{isCashView ? 'Cash Statement' : 'Online Statement'}:</strong> Every recorded {isCashView ? 'cash' : 'online'} payment across all leads, newest date on top. Edit the Collector / Receiver and Verify columns inline — changes save automatically.
          {!isCashView && (
            <> Cashfree payments are verified automatically as soon as the customer pays (<span className="font-semibold text-emerald-700">green</span>); you can also verify / un-verify any row by hand (<span className="font-semibold text-orange-600">orange</span> = verified manually).</>
          )}
        </div>
        {liveNote && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-sm font-medium text-emerald-800">{liveNote}</div>
        )}

        {/* Toolbar: date filter + actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(''); setToDate(''); }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}

          <div className="flex-1" />

          {saving && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
            </span>
          )}
          {lastChecked && !isCashView && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700" title="Cashfree payments are re-checked automatically every 20 seconds">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Cashfree check · {lastChecked.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { fetchAll(); syncCashfree(); }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#00843d] hover:bg-[#00622d] rounded-lg transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" /> Download Excel
          </button>
        </div>

        {/* Summary — Today's Cash/Online/Total, all-time ("up to date") Cash/Online/Total, and pending balance */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Today Cash</p>
            <p className="text-lg font-semibold text-[#00843d] flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(todayCash)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Today Online</p>
            <p className="text-lg font-semibold text-blue-600 flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(todayOnline)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Today Total Received</p>
            <p className="text-lg font-semibold text-slate-800 flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(todayReceived)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Cash</p>
            <p className="text-lg font-semibold text-[#00843d] flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(totalCash)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Online</p>
            <p className="text-lg font-semibold text-blue-600 flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(totalOnline)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Up to Date Total</p>
            <p className="text-lg font-semibold text-[#00843d] flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(upToDateTotal)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Today Pending</p>
            <p className="text-lg font-semibold text-amber-600 flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(todayPending)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Pending Amount</p>
            <p className="text-lg font-semibold text-red-600 flex items-center gap-1">
              <IndianRupee className="w-4 h-4" /> {formatINR(pendingAmount)}
            </p>
          </div>
        </div>

        {/* Cash view: name-wise cash collection */}
        {isCashView && !loading && !error && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Name-wise Cash Collection</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490]">
                  <tr>
                    <th className={th}>Sr. No</th>
                    <th className={th}>Name</th>
                    <th className={`${th} text-right`}>Today Cash</th>
                    <th className={`${th} text-right`}>Total Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashByName.map((c, i) => (
                    <tr key={c.name} className="hover:bg-slate-50">
                      <td className={td}>{i + 1}</td>
                      <td className={`${td} font-medium`}>{c.name}</td>
                      <td className={`${td} text-right`}>{formatINR(c.today)}</td>
                      <td className={`${td} text-right font-semibold text-[#00843d]`}>{formatINR(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className={`${td} font-semibold`} colSpan={2}>Total</td>
                    <td className={`${td} text-right font-bold`}>{formatINR(cashByName.reduce((s, c) => s + c.today, 0))}</td>
                    <td className={`${td} text-right font-bold text-[#00843d]`}>{formatINR(cashByName.reduce((s, c) => s + c.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490] border-b border-[#00622d]">
                <tr>
                  <th className={th}>Sr. No</th>
                  <th className={th}>Payment Date</th>
                  <th className={th}>Lead Date</th>
                  <th className={th}>Appointment Date</th>
                  <th className={th}>Token No</th>
                  <th className={th}>Lead Name</th>
                  <th className={th}>Owner Name</th>
                  <th className={th}>Tenant Name</th>
                  <th className={th}>Payer Name</th>
                  <th className={th}>Mode (Cash/Online)</th>
                  <th className={th}>Transaction No/Cash</th>
                  <th className={`${th} text-right`}>Amount</th>
                  <th className={th}>Collector / Receiver</th>
                  <th className={th}>Executive Name</th>
                  <th className={`${th} text-center`}>Verify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={COLS} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading payments…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={COLS} className="px-4 py-10 text-center text-red-600">{error}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS} className="px-4 py-10 text-center text-slate-400">No payments found.</td>
                  </tr>
                ) : (
                  pagedRows.map((r, i) => (
                    <tr
                      key={`${r.leadId}-${r.paymentIndex}`}
                      className={`transition-colors ${
                        r.autoVerified
                          ? 'bg-emerald-100 hover:bg-emerald-200' // Cashfree confirmed → auto-verified
                          : r.verified
                            ? 'bg-orange-400 hover:bg-orange-500'
                            : 'hover:bg-slate-50' // not verified → no colour
                      }`}
                    >
                      <td className={`${td} font-medium`}>{safePage * ROWS_PER_PAGE + i + 1}</td>
                      <td className={`${td} font-semibold text-slate-800`}>{formatDate(r.date)}</td>
                      <td className={td}>{formatDate(r.leadDate)}</td>
                      <td className={td}>{formatDate(r.appointmentDate)}</td>
                      <td className={`${td} font-medium`}>{r.tokenNo}</td>
                      <td className={td}>{r.leadName}</td>
                      <td className={td}>{r.ownerName}</td>
                      <td className={td}>{r.tenantName}</td>
                      <td className={td}>{r.payerName}</td>
                      <td className={td}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          isOnlineMode(r.mode) ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {modeLabel(r.mode)}
                        </span>
                      </td>
                      <td className={td}>
                        {isOnlineMode(r.mode) ? (
                          <span className="font-mono" title={r.cashfreeConfirmed ? 'Cashfree transaction (UTR)' : 'Entered by hand'}>
                            {r.transactionNumber}
                            {r.cashfreeConfirmed && <span className="ml-1.5 font-sans text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5">CF</span>}
                          </span>
                        ) : 'Cash'}
                      </td>
                      <td className={`${td} text-right font-semibold text-[#00843d]`}>{formatINR(r.amount)}</td>
                      <td className={td}>
                        {isCashView ? (
                          <select
                            value={effectiveCollector(r)}
                            onChange={(e) => savePaymentField(r.leadId, r.paymentIndex, { collectorReceiver: e.target.value })}
                            className="w-36 px-2 py-1 border border-slate-200 rounded-md text-sm outline-none bg-white focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
                          >
                            <option value="">—</option>
                            {(effectiveCollector(r) && !(CASH_RECEIVERS as readonly string[]).includes(effectiveCollector(r))
                              ? [effectiveCollector(r), ...CASH_RECEIVERS]
                              : [...CASH_RECEIVERS]
                            ).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        ) : (
                        <input
                          key={`${r.leadId}-${r.paymentIndex}-cr`}
                          defaultValue={effectiveCollector(r)}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (r.collectorReceiver || '')) savePaymentField(r.leadId, r.paymentIndex, { collectorReceiver: v });
                          }}
                          placeholder="—"
                          className="w-36 px-2 py-1 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
                        />
                        )}
                      </td>
                      <td className={td}>{r.executiveName}</td>
                      <td className={`${td} text-center`}>
                        {isCashView ? (
                          // Cash: verified by Tejas or Anuja (choosing a name marks it verified).
                          <select
                            value={r.verified ? r.verifiedBy : ''}
                            onChange={(e) => savePaymentField(r.leadId, r.paymentIndex, { verifiedBy: e.target.value, verified: !!e.target.value })}
                            className="w-32 px-2 py-1 border border-slate-200 rounded-md text-sm outline-none bg-white focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
                            title="Verified by"
                          >
                            <option value="">Not verified</option>
                            {(r.verified && r.verifiedBy && !(CASH_VERIFIERS as readonly string[]).includes(r.verifiedBy)
                              ? [r.verifiedBy, ...CASH_VERIFIERS]
                              : [...CASH_VERIFIERS]
                            ).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        ) : (
                        // Online: auto-verified by Cashfree, and still toggleable by hand.
                        <button
                          type="button"
                          onClick={() => savePaymentField(
                            r.leadId, r.paymentIndex,
                            r.verified ? { verified: false, verifiedBy: '' } : { verified: true, verifiedBy: myName },
                          )}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            r.autoVerified
                              ? 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                              : r.verified
                                ? 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={
                            r.autoVerified
                              ? 'Payment received in Cashfree — verified automatically. Click to mark as not verified.'
                              : r.verified
                                ? `Verified by ${r.verifiedBy || 'hand'} — click to un-verify`
                                : r.cashfreeConfirmed
                                  ? 'Paid in Cashfree but marked not verified — click to verify'
                                  : 'Click to verify'
                          }
                        >
                          {r.verified ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                          {r.autoVerified ? 'Auto · Cashfree' : r.verified ? `Yes${r.verifiedBy ? ` · ${r.verifiedBy}` : ''}` : 'No'}
                        </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className={`${td} font-semibold`} colSpan={11}>Total</td>
                    <td className={`${td} text-right font-bold text-[#00843d]`}>{formatINR(total)}</td>
                    <td className={td} colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!loading && !error && rows.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Showing {safePage * ROWS_PER_PAGE + 1}–{Math.min((safePage + 1) * ROWS_PER_PAGE, rows.length)} of {rows.length} · page {safePage + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"><ChevronLeft className="w-4 h-4" /></button>
                {buildPageList(safePage, totalPages).map((p, i) =>
                  p === -1 ? (
                    <span key={`gap-${i}`} className="px-2 text-slate-400 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={p === safePage ? 'page' : undefined}
                      className={`min-w-[2rem] px-2.5 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                        p === safePage
                          ? 'bg-[#00843d] text-white border-[#00843d] shadow-sm'
                          : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {p + 1}
                    </button>
                  ),
                )}
                <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="p-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </AppShell>
  );
}
