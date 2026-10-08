'use client';

// ============================================================================
// 🔹 Net Amount Panel — Cash Flow / Net Cash summary (NOT a P&L). Lives inside
// the Payment Statement page as the "Net Amount" tab. Ties together the money
// coming IN (received Cash / Online + Outstanding) with the money going OUT and
// exports the whole statement to Excel.
//
//   Total Revenue      = Cash + Online + Outstanding
//   Actual Received    = Cash + Online
//   A. Service Exp.    = GRN + DHC + Commission (lead-derived) + manual service-related
//   B. Operating Exp.  = Salary, Rent, Electricity, Internet, Software, Ads, Travel…
//   Gross Amount       = Actual Received − A (Service Expenses)
//   All Expenses       = A + B
//   Net Amount (Cash)  = Actual Received − All Expenses
//
// Outstanding is part of Total Revenue but NOT of Net — Net reflects only cash
// actually received. GRN / DHC / Commission mirror the Expenses tab; manual
// expenses come from /api/expenses (summary.byCategory) and are split into
// A / B using EXPENSE_CATEGORY_OPTS[].service.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download, Loader2, RefreshCw, IndianRupee, TrendingUp, TrendingDown,
  Banknote, Clock, Scale, Wallet, Briefcase, Receipt,
} from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import { EXPENSE_CATEGORY_OPTS } from '@/components/expenses-panel';

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
interface CategoryTotal { category: string; total: number }
interface Line { label: string; amount: number }

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

const SERVICE_CATEGORIES = EXPENSE_CATEGORY_OPTS.filter((c) => c.service);
const OPERATING_CATEGORIES = EXPENSE_CATEGORY_OPTS.filter((c) => !c.service);

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

  // Manual expenses (the `expenses` collection) per category for the date range —
  // read from the server-computed summary.byCategory (covers ALL matching expenses).
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [manualLoading, setManualLoading] = useState(false);

  const fetchManual = useCallback(async () => {
    if (authLoading || !user) return;
    setManualLoading(true);
    try {
      const params = new URLSearchParams({ page: '0', pageSize: '1' });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await apiFetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      setByCategory(data?.summary?.byCategory || []);
    } catch (err) {
      console.error('Net Amount expense fetch error:', err);
      setByCategory([]);
    } finally {
      setManualLoading(false);
    }
  }, [apiFetch, authLoading, user, fromDate, toDate]);

  useEffect(() => { fetchManual(); }, [fetchManual]);

  const handleRefresh = useCallback(() => { onRefresh(); fetchManual(); }, [onRefresh, fetchManual]);

  // ---- Core cash-flow maths over the loaded leads + manual expenses -----------
  const nc = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null; // include whole "to" day

    let cash = 0, online = 0, outstanding = 0;
    let grn = 0, dhc = 0, commission = 0;

    for (const lead of leads) {
      // Received — payments split Cash vs Online, filtered by payment date.
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

      // GRN / DHC / Commission — each by its own date.
      const pay = lead.payment;
      if (pay) {
        if (inRange(pay.govtGrnDate, from, to)) grn += toNum(pay.grnAmount);
        if (inRange(pay.dhcDate, from, to)) dhc += toNum(pay.dhcAmount);
        if (inRange(pay.commissionDate, from, to)) commission += toNum(pay.commissionAmount);
      }
    }

    const catTotal = (key: string) => byCategory.find((c) => c.category === key)?.total || 0;
    const serviceLines: Line[] = SERVICE_CATEGORIES.map((c) => ({ label: c.label, amount: catTotal(c.key) }));
    const operatingLines: Line[] = OPERATING_CATEGORIES.map((c) => ({ label: c.label, amount: catTotal(c.key) }));

    const received = cash + online;
    const totalRevenue = received + outstanding;
    const grnDhcComm = grn + dhc + commission;
    const serviceExpenses = grnDhcComm + serviceLines.reduce((s, l) => s + l.amount, 0);
    const operatingExpenses = operatingLines.reduce((s, l) => s + l.amount, 0);
    const allExpenses = serviceExpenses + operatingExpenses;
    const gross = received - serviceExpenses;
    const net = received - allExpenses; // Net Cash excludes outstanding (not yet collected).

    return {
      cash, online, outstanding, received, totalRevenue,
      grn, dhc, commission, grnDhcComm, serviceLines, serviceExpenses,
      operatingLines, operatingExpenses, allExpenses, gross, net,
    };
  }, [leads, fromDate, toDate, byCategory]);

  const busy = loading || manualLoading;

  // ---- Excel export — the full statement as labelled line items ---------------
  const handleExport = useCallback(() => {
    const rangeLabel = fromDate || toDate ? `${fromDate || '…'} to ${toDate || '…'}` : 'All time';
    const blank = { Section: '', 'Line Item': '', Amount: '' };
    const rows: Array<Record<string, string | number>> = [
      { Section: 'PERIOD', 'Line Item': rangeLabel, Amount: '' },
      blank,
      { Section: 'REVENUE', 'Line Item': 'Cash', Amount: nc.cash },
      { Section: 'REVENUE', 'Line Item': 'Online', Amount: nc.online },
      { Section: 'REVENUE', 'Line Item': 'Actual Received (Cash + Online)', Amount: nc.received },
      { Section: 'REVENUE', 'Line Item': 'Outstanding (pending)', Amount: nc.outstanding },
      { Section: 'REVENUE', 'Line Item': 'Total Revenue', Amount: nc.totalRevenue },
      blank,
      { Section: 'A. SERVICE EXPENSES', 'Line Item': 'GRN Amount', Amount: nc.grn },
      { Section: 'A. SERVICE EXPENSES', 'Line Item': 'DHC Amount', Amount: nc.dhc },
      { Section: 'A. SERVICE EXPENSES', 'Line Item': 'Commission Amount', Amount: nc.commission },
      ...nc.serviceLines.map((l) => ({ Section: 'A. SERVICE EXPENSES', 'Line Item': l.label, Amount: l.amount })),
      { Section: 'A. SERVICE EXPENSES', 'Line Item': 'Total Service Expenses', Amount: nc.serviceExpenses },
      blank,
      { Section: 'GROSS', 'Line Item': 'Gross Amount (Received − Service Expenses)', Amount: nc.gross },
      blank,
      ...nc.operatingLines.map((l) => ({ Section: 'B. OPERATING EXPENSES', 'Line Item': l.label, Amount: l.amount })),
      { Section: 'B. OPERATING EXPENSES', 'Line Item': 'Total Operating Expenses', Amount: nc.operatingExpenses },
      blank,
      { Section: 'EXPENSES', 'Line Item': 'All Expenses (A + B)', Amount: nc.allExpenses },
      blank,
      { Section: 'NET CASH', 'Line Item': 'Net Amount (Received − All Expenses)', Amount: nc.net },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 42 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Net Amount');
    XLSX.writeFile(wb, `Net_Amount_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [nc, fromDate, toDate]);

  // ---- Shared cell styling (matches the other tabs) --------------------------
  const td = 'px-4 py-3 text-sm whitespace-nowrap';

  const cards: Array<{ label: string; value: number; sub: string; color: string; Icon: typeof TrendingUp }> = [
    { label: 'Total Revenue', value: nc.totalRevenue, sub: 'Cash + Online + Outstanding', color: 'text-emerald-600', Icon: TrendingUp },
    { label: 'Actual Received', value: nc.received, sub: `Cash ${formatINR(nc.cash)} + Online ${formatINR(nc.online)}`, color: 'text-[#00843d]', Icon: Banknote },
    { label: 'Outstanding', value: nc.outstanding, sub: 'Pending, not yet collected', color: 'text-amber-600', Icon: Clock },
    { label: 'Gross Amount', value: nc.gross, sub: 'Received − Service Expenses', color: 'text-blue-600', Icon: Wallet },
    { label: 'Operating Expenses', value: nc.operatingExpenses, sub: 'Salary, Rent, Ads, Bills…', color: 'text-red-600', Icon: Briefcase },
    { label: 'Total GRN + DHC + Commission', value: nc.grnDhcComm, sub: `GRN ${formatINR(nc.grn)} · DHC ${formatINR(nc.dhc)} · Comm ${formatINR(nc.commission)}`, color: 'text-purple-600', Icon: Receipt },
  ];

  // One table section: the category cell spans its lines + the subtotal row.
  const section = (title: string, titleClass: string, lines: Line[], totalLabel: string, total: number, totalClass: string) => (
    <>
      {lines.map((l, i) => (
        <tr key={`${title}-${l.label}`}>
          {i === 0 && <td className={`${td} font-semibold align-top ${titleClass}`} rowSpan={lines.length + 1}>{title}</td>}
          <td className={`${td} text-slate-700`}>{l.label}</td>
          <td className={`${td} text-right font-semibold text-slate-700`}>{formatINR(l.amount)}</td>
        </tr>
      ))}
      <tr className="bg-slate-50">
        <td className={`${td} font-semibold text-slate-800`}>{totalLabel}</td>
        <td className={`${td} text-right font-bold ${totalClass}`}>{formatINR(total)}</td>
      </tr>
    </>
  );

  return (
    <>
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
        💰 <strong>Net Amount (Cash Flow / Net Cash):</strong> Actual money received minus all expenses. This is a cash-flow view, not Profit &amp; Loss — Outstanding is part of Total Revenue but is excluded from Net.
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

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Icon className={`w-4 h-4 ${color}`} /> {label}</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${color}`}>
              <IndianRupee className="w-5 h-5" /> {formatINR(value)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* All Expenses + Net Cash headline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-red-600" /> All Expenses</p>
          <p className="text-2xl font-bold text-red-600 flex items-center gap-1">
            <IndianRupee className="w-5 h-5" /> {formatINR(nc.allExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-1">A. Service {formatINR(nc.serviceExpenses)} + B. Operating {formatINR(nc.operatingExpenses)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${nc.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Scale className="w-4 h-4 text-slate-600" /> Net Amount (Net Cash)</p>
          <p className={`text-2xl font-bold flex items-center gap-1 ${nc.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            <IndianRupee className="w-5 h-5" /> {formatINR(nc.net)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Actual Received − All Expenses</p>
        </div>
      </div>

      {/* Breakdown table — Revenue, A. Service, Gross, B. Operating, Net Cash */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {busy && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#00843d] via-[#0d9488] to-[#0e7490]">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Category</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">Line Item</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {section(
                'Revenue', 'text-emerald-800',
                [
                  { label: 'Cash', amount: nc.cash },
                  { label: 'Online', amount: nc.online },
                  { label: 'Actual Received (Cash + Online)', amount: nc.received },
                  { label: 'Outstanding (pending)', amount: nc.outstanding },
                ],
                'Total Revenue', nc.totalRevenue, 'text-emerald-700',
              )}
              {section(
                'A. Service Expenses', 'text-purple-800',
                [
                  { label: 'GRN Amount', amount: nc.grn },
                  { label: 'DHC Amount', amount: nc.dhc },
                  { label: 'Commission Amount', amount: nc.commission },
                  ...nc.serviceLines,
                ],
                'Total Service Expenses', nc.serviceExpenses, 'text-purple-700',
              )}
              <tr className="bg-blue-50">
                <td className={`${td} font-semibold text-blue-800`} colSpan={2}>Gross Amount (Received − Service Expenses)</td>
                <td className={`${td} text-right font-bold text-blue-700`}>{formatINR(nc.gross)}</td>
              </tr>
              {section(
                'B. Operating Expenses', 'text-red-800',
                nc.operatingLines,
                'Total Operating Expenses', nc.operatingExpenses, 'text-red-700',
              )}
              <tr className="bg-red-50">
                <td className={`${td} font-semibold text-red-800`} colSpan={2}>All Expenses (A + B)</td>
                <td className={`${td} text-right font-bold text-red-700`}>{formatINR(nc.allExpenses)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className={nc.net >= 0 ? 'bg-emerald-100' : 'bg-red-100'}>
                <td className={`${td} font-bold text-slate-800`} colSpan={2}>Net Amount (Actual Received − All Expenses)</td>
                <td className={`${td} text-right font-bold text-lg ${nc.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatINR(nc.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
