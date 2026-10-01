'use client';

// ============================================================================
// 🔹 P&L Panel — Profit & Loss / Net Amount summary. Lives inside the Payment
// Statement page as the "Net Amount" tab. Ties together the money coming IN
// (received Cash / Online + Outstanding) with the money going OUT (lead-derived
// Govt GRN / DHC / Commission + manually-entered "Other" expenses) into a single
// Net Amount, and exports the whole statement to Excel.
//
//   Total Revenue   = Cash + Online (+ Outstanding, shown for reference)
//   Total Expenses  = GRN + DHC + Commission + Other
//   Net Amount      = (Cash + Online received) − Total Expenses
//
// Outstanding (pending / not-yet-collected money) is shown as its own revenue
// line but is NOT counted in the Net — Net reflects only money actually received.
//
// Revenue (Cash / Online) mirrors the Statement tab; Outstanding mirrors its
// pending-balance maths; GRN / DHC / Commission mirror the Expenses tab; "Other"
// is the total of the manual `expenses` collection fetched from /api/expenses.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download, Loader2, RefreshCw, IndianRupee, TrendingUp, TrendingDown,
  Banknote, Smartphone, Clock, Scale,
} from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';

// ---------------------------------------------------------------------------
// Types (minimal — only what this panel reads)
// ---------------------------------------------------------------------------
interface PaymentDetail {
  paymentDate?: string;
  paymentAmount?: string | number;
  modeOfPayment?: string;
}
interface PnlLead {
  id: string;
  leadDate?: string;
  createdDate?: string;
  payment?: {
    totalAmount?: number | string;
    outstandingAmount?: number | string;
    grnAmount?: number | string;
    govtGrnDate?: string;
    dhcAmount?: number | string;
    dhcDate?: string;
    commissionAmount?: number | string;
    commissionDate?: string;
  };
  paymentDetails?: PaymentDetail[];
}

// ---------------------------------------------------------------------------
// Helpers (kept in sync with payment-statement/page.tsx & expenses-panel.tsx)
// ---------------------------------------------------------------------------
const toNum = (v?: number | string | null): number => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const formatINR = (v?: number | string | null): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(toNum(v));

// Online = any recorded mode that isn't cash (UPI / bank transfer / card / cheque…).
const isOnlineMode = (mode?: string): boolean => !!mode && mode !== '-' && !/cash/i.test(mode);

// Is a date string within the optional [from, to] range? No range → always true.
const inRange = (d: string | undefined, from: number | null, to: number | null): boolean => {
  if (from == null && to == null) return true;
  if (!d) return false;
  const t = new Date(d).getTime();
  if (isNaN(t)) return false;
  if (from != null && t < from) return false;
  if (to != null && t > to) return false;
  return true;
};

const leadDateOf = (lead: PnlLead): string => lead.leadDate || lead.createdDate || '';

// ---------------------------------------------------------------------------
interface PnlPanelProps {
  leads: PnlLead[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function PnlPanel({ leads, loading, error, onRefresh }: PnlPanelProps) {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // "Other" expenses come from the manual `expenses` collection. We only need the
  // summary total for the current date range, so fetch a single row and read the
  // server-computed summary.totalAmount (it's across ALL matching expenses).
  const [otherExpense, setOtherExpense] = useState(0);
  const [otherLoading, setOtherLoading] = useState(false);

  const fetchOther = useCallback(async () => {
    if (authLoading || !user) return;
    setOtherLoading(true);
    try {
      const params = new URLSearchParams({ page: '0', pageSize: '1' });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await apiFetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      setOtherExpense(toNum(data?.summary?.totalAmount));
    } catch (err) {
      console.error('P&L other-expense fetch error:', err);
      setOtherExpense(0);
    } finally {
      setOtherLoading(false);
    }
  }, [apiFetch, authLoading, user, fromDate, toDate]);

  useEffect(() => { fetchOther(); }, [fetchOther]);

  const handleRefresh = useCallback(() => { onRefresh(); fetchOther(); }, [onRefresh, fetchOther]);

  // ---- Core P&L maths over the loaded leads + the fetched "Other" total -------
  const pnl = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null; // include whole "to" day

    let cash = 0, online = 0, outstanding = 0;
    let grn = 0, dhc = 0, commission = 0;

    for (const lead of leads) {
      // Revenue — received payments, split Cash vs Online, filtered by payment date.
      for (const p of lead.paymentDetails || []) {
        const amt = toNum(p.paymentAmount);
        if (amt <= 0) continue;
        if (!inRange(p.paymentDate, from, to)) continue;
        if (isOnlineMode(p.modeOfPayment)) online += amt; else cash += amt;
      }

      // Outstanding — Legal Fees (totalAmount) − received, clamped at 0, by lead date.
      const legalFees = toNum(lead.payment?.totalAmount ?? lead.payment?.outstandingAmount);
      if (legalFees > 0 && inRange(leadDateOf(lead), from, to)) {
        const received = (lead.paymentDetails || []).reduce((s, p) => s + toNum(p.paymentAmount), 0);
        const balance = legalFees - received;
        if (balance > 0) outstanding += balance;
      }

      // Expenses — GRN / DHC / Commission, each by its own date.
      const pay = lead.payment;
      if (pay) {
        if (inRange(pay.govtGrnDate, from, to)) grn += toNum(pay.grnAmount);
        if (inRange(pay.dhcDate, from, to)) dhc += toNum(pay.dhcAmount);
        if (inRange(pay.commissionDate, from, to)) commission += toNum(pay.commissionAmount);
      }
    }

    const received = cash + online;
    const totalRevenue = received + outstanding;
    const totalExpenses = grn + dhc + commission + otherExpense;
    const net = received - totalExpenses; // Net excludes outstanding (money not yet collected).

    return { cash, online, outstanding, received, totalRevenue, grn, dhc, commission, other: otherExpense, totalExpenses, net };
  }, [leads, fromDate, toDate, otherExpense]);

  const busy = loading || otherLoading;

  // ---- Excel export — the full statement as labelled line items ---------------
  const handleExport = useCallback(() => {
    const rangeLabel = fromDate || toDate ? `${fromDate || '…'} to ${toDate || '…'}` : 'All time';
    const rows: Array<Record<string, string | number>> = [
      { Section: 'PERIOD', 'Line Item': rangeLabel, Amount: '' },
      { Section: '', 'Line Item': '', Amount: '' },
      { Section: 'REVENUE', 'Line Item': 'Cash', Amount: pnl.cash },
      { Section: 'REVENUE', 'Line Item': 'Online', Amount: pnl.online },
      { Section: 'REVENUE', 'Line Item': 'Outstanding (pending)', Amount: pnl.outstanding },
      { Section: 'REVENUE', 'Line Item': 'Total Revenue', Amount: pnl.totalRevenue },
      { Section: '', 'Line Item': '', Amount: '' },
      { Section: 'EXPENSES', 'Line Item': 'GRN Amount', Amount: pnl.grn },
      { Section: 'EXPENSES', 'Line Item': 'DHC Amount', Amount: pnl.dhc },
      { Section: 'EXPENSES', 'Line Item': 'Commission Amount', Amount: pnl.commission },
      { Section: 'EXPENSES', 'Line Item': 'Other Amount', Amount: pnl.other },
      { Section: 'EXPENSES', 'Line Item': 'Total Expenses', Amount: pnl.totalExpenses },
      { Section: '', 'Line Item': '', Amount: '' },
      { Section: 'NET', 'Line Item': 'Net Amount (Received − Expenses)', Amount: pnl.net },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Net Amount');
    XLSX.writeFile(wb, `Net_Amount_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [pnl, fromDate, toDate]);

  // ---- Shared cell styling (matches the other tabs) --------------------------
  const td = 'px-4 py-3 text-sm whitespace-nowrap';

  return (
    <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
        📊 <strong>Net Amount (Profit &amp; Loss):</strong> Total Revenue minus all expenses. Net counts only money actually received — Outstanding is shown for reference but excluded from Net.
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

        <button
          onClick={handleRefresh}
          disabled={busy}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button
          onClick={handleExport}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#00843d] hover:bg-[#00622d] rounded-lg transition-colors disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> Download Excel
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Headline cards: Total Revenue · Total Expenses · Net Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-600" /> Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
            <IndianRupee className="w-5 h-5" /> {formatINR(pnl.totalRevenue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Received {formatINR(pnl.received)} + Outstanding {formatINR(pnl.outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-red-600" /> Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 flex items-center gap-1">
            <IndianRupee className="w-5 h-5" /> {formatINR(pnl.totalExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-1">GRN + DHC + Commission + Other</p>
        </div>
        <div className={`rounded-xl border p-5 ${pnl.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Scale className="w-4 h-4 text-slate-600" /> Net Amount</p>
          <p className={`text-2xl font-bold flex items-center gap-1 ${pnl.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            <IndianRupee className="w-5 h-5" /> {formatINR(pnl.net)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Received − Total Expenses</p>
        </div>
      </div>

      {/* Breakdown table — Revenue then Expenses then Net */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {busy && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
          </div>
        )}
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490]">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Category</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Line Item</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Revenue */}
            <tr className="bg-emerald-50/50">
              <td className={`${td} font-semibold text-emerald-800`} rowSpan={4}>Revenue</td>
              <td className={`${td} text-slate-700 flex items-center gap-2`}><Banknote className="w-4 h-4 text-emerald-600" /> Cash</td>
              <td className={`${td} text-right font-semibold text-emerald-700`}>{formatINR(pnl.cash)}</td>
            </tr>
            <tr>
              <td className={`${td} text-slate-700`}><span className="inline-flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-600" /> Online</span></td>
              <td className={`${td} text-right font-semibold text-blue-700`}>{formatINR(pnl.online)}</td>
            </tr>
            <tr>
              <td className={`${td} text-slate-700`}><span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Outstanding (pending)</span></td>
              <td className={`${td} text-right font-semibold text-amber-700`}>{formatINR(pnl.outstanding)}</td>
            </tr>
            <tr className="bg-emerald-50/70">
              <td className={`${td} font-semibold text-slate-800`}>Total Revenue</td>
              <td className={`${td} text-right font-bold text-emerald-700`}>{formatINR(pnl.totalRevenue)}</td>
            </tr>

            {/* Expenses */}
            <tr className="bg-red-50/40">
              <td className={`${td} font-semibold text-red-800`} rowSpan={5}>Expenses</td>
              <td className={`${td} text-slate-700`}>GRN Amount</td>
              <td className={`${td} text-right font-semibold text-slate-700`}>{formatINR(pnl.grn)}</td>
            </tr>
            <tr>
              <td className={`${td} text-slate-700`}>DHC Amount</td>
              <td className={`${td} text-right font-semibold text-slate-700`}>{formatINR(pnl.dhc)}</td>
            </tr>
            <tr>
              <td className={`${td} text-slate-700`}>Commission Amount</td>
              <td className={`${td} text-right font-semibold text-slate-700`}>{formatINR(pnl.commission)}</td>
            </tr>
            <tr>
              <td className={`${td} text-slate-700`}>Other Amount</td>
              <td className={`${td} text-right font-semibold text-slate-700`}>{formatINR(pnl.other)}</td>
            </tr>
            <tr className="bg-red-50/70">
              <td className={`${td} font-semibold text-slate-800`}>Total Expenses</td>
              <td className={`${td} text-right font-bold text-red-700`}>{formatINR(pnl.totalExpenses)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className={pnl.net >= 0 ? 'bg-emerald-100' : 'bg-red-100'}>
              <td className={`${td} font-bold text-slate-800`} colSpan={2}>Net Amount (Received − Total Expenses)</td>
              <td className={`${td} text-right font-bold text-lg ${pnl.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatINR(pnl.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
