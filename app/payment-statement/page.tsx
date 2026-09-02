'use client';

// ============================================================================
// 🔹 PANEL: Payment Statement (date-wise)
// Pulls every recorded payment from the shared /api/leads API, flattens each
// lead's paymentDetails into one row per payment (newest date on top) and
// exports to Excel.
//
// Columns: Lead Date · Appointment Date · Token Number · Lead No · Lead Name ·
//          Phone · Payer Name · Mode · Transaction ID · Amount ·
//          Collector / Receiver (editable) · Executive Name · Verify (Yes/No).
//
// "Collector / Receiver" and "Verify" are edited inline and saved back onto the
// lead's paymentDetails via PATCH /api/leads (new per-payment fields).
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, RefreshCw, FileText, Wallet, Check, X as XIcon, IndianRupee, ChevronLeft, ChevronRight } from 'lucide-react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import BillingPanel from '@/components/billing-panel';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';

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
  paymentDetails?: PaymentDetail[];
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

// Normalised Cash / Online label for the "Mode" column.
const modeLabel = (mode?: string): string => (isOnlineMode(mode) ? 'Online' : 'Cash');

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
// Flatten leads → statement rows (one row per recorded payment)
// ---------------------------------------------------------------------------
const buildRows = (leads: Lead[]): StatementRow[] => {
  const rows: StatementRow[] = [];
  for (const lead of leads) {
    const tokenNo = lead.agreement?.tokenNo || '-';
    const name = leadName(lead);
    const ownerName = personName(lead.agreement?.owner);
    const tenantName = personName(lead.agreement?.tenant);
    const leadDate = lead.leadDate || lead.createdDate || '';
    const appointmentDate = lead.appointmentTime || '';
    const executiveName = lead.assignedToUserName || '-';
    const details = lead.paymentDetails || [];
    details.forEach((p, idx) => {
      const amount = toNum(p.paymentAmount);
      // Only include real payments (has an amount or a date).
      if (amount <= 0 && !p.paymentDate) return;
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
        transactionNumber: p.transactionNumber || '-',
        amount,
        collectorReceiver: p.collectorReceiver || '',
        executiveName,
        verified: p.verified === true,
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0); // 0-based page for the statement table (20 rows/page)
  // Two views in one page: the date-wise "Statement" and the "Billing" system.
  const [tab, setTab] = useState<'statement' | 'billing'>('statement');

  // Fetch ALL leads. First page tells us the total, then the remaining pages are
  // fetched in PARALLEL (instead of one-by-one) so the statement loads much faster.
  const fetchAll = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const pageSize = 200;
      const pageUrl = (p: number) =>
        `/api/leads?${new URLSearchParams({ transitLevel: 'ALL', viewAll: 'true', page: p.toString(), pageSize: pageSize.toString() })}`;

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
      setLeads(collected);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, authLoading, user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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

  // All rows (newest first), then apply the optional date-range filter.
  const allRows = useMemo(() => buildRows(leads), [leads]);
  const rows = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null; // include the whole "to" day
    return allRows.filter((r) => {
      if (!from && !to) return true;
      const t = dateValue(r.date);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allRows, fromDate, toDate]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  // Client-side pagination for the statement table — 20 rows per page.
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  // Snap back into range if the row set shrinks (e.g. after applying a date filter).
  useEffect(() => { setPage(0); }, [fromDate, toDate]);
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
  const upToDateTotal = totalCash + totalOnline;

  // Excel export — same rows & order as shown on screen.
  const handleExport = useCallback(() => {
    const exportData = rows.map((r, i) => ({
      'Sr. No': i + 1,
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
      'Collector / Receiver': r.collectorReceiver || '-',
      'Executive Name': r.executiveName,
      Verify: r.verified ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Statement');
    XLSX.writeFile(wb, `Payment_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [rows]);

  const th = 'px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm text-slate-700 whitespace-nowrap';
  const COLS = 14;

  return (
    <AppShell>
      <Header title="Payment Statement" />
      <div className="p-6 space-y-4">
        {/* Tabs: date-wise Statement | Billing system */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {([['statement', 'Statement', FileText], ['billing', 'Billing', Wallet]] as const).map(([key, label, Icon]) => (
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
        ) : (
        <>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          🧾 <strong>Date-wise Statement:</strong> Every recorded payment across all leads, newest date on top. Edit the Collector / Receiver and Verify columns inline — changes save automatically.
        </div>

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
          <button
            onClick={fetchAll}
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

        {/* Summary — Today's Cash/Online/Total and all-time ("up to date") Cash/Online/Total */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490] border-b border-[#00622d]">
                <tr>
                  <th className={th}>Sr. No</th>
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
                      className={`transition-colors ${r.verified ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'}`}
                    >
                      <td className={`${td} font-medium`}>{safePage * ROWS_PER_PAGE + i + 1}</td>
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
                      <td className={td}>{isOnlineMode(r.mode) ? r.transactionNumber : 'Cash'}</td>
                      <td className={`${td} text-right font-semibold text-[#00843d]`}>{formatINR(r.amount)}</td>
                      <td className={td}>
                        <input
                          key={`${r.leadId}-${r.paymentIndex}-cr`}
                          defaultValue={r.collectorReceiver}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (r.collectorReceiver || '')) savePaymentField(r.leadId, r.paymentIndex, { collectorReceiver: v });
                          }}
                          placeholder="—"
                          className="w-36 px-2 py-1 border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-[#00843d] focus:ring-opacity-30"
                        />
                      </td>
                      <td className={td}>{r.executiveName}</td>
                      <td className={`${td} text-center`}>
                        <button
                          type="button"
                          onClick={() => savePaymentField(r.leadId, r.paymentIndex, { verified: !r.verified })}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            r.verified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Click to toggle verification"
                        >
                          {r.verified ? <Check className="w-3.5 h-3.5" /> : <XIcon className="w-3.5 h-3.5" />}
                          {r.verified ? 'Yes' : 'No'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className={`${td} font-semibold`} colSpan={10}>Total</td>
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
