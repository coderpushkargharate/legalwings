'use client';

// ============================================================================
// 🔹 Expenses Panel — Govt GRN / DHC / Commission (money going OUT) per lead.
// Lives inside the Payment Statement page as the "Expenses" tab. Mirrors the
// Statement table's look, but each row is one lead's expense pulled from
// lead.payment (GRN, DHC and Commission fields).
//
// Columns: Sr. No · Lead Date · Token No · Lead Name · Back Work Account ·
//          Govt GRN Date · GRN Number · GRN Amount · DHC Date · DHC Number ·
//          DHC Amount · Commission Date · Commission Name · AC Amount.
//
// "Back Work Account" = the Backend-team member who worked the lead. Once a lead
// is forwarded on to the Backend team, `assignedToUserName` becomes that backend
// employee (see note in payment-statement/page.tsx), so we use it here, falling
// back to the creator so the column is never blank.
// "AC Amount" = lead.payment.commissionAmount.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, RefreshCw, IndianRupee, ChevronLeft, ChevronRight, TrendingDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (minimal — only what this panel reads)
// ---------------------------------------------------------------------------
interface ExpenseLead {
  id: string;
  client?: { firstName?: string; lastName?: string };
  agreement?: { tokenNo?: string };
  leadDate?: string;
  createdDate?: string;
  assignedToUserName?: string | null;
  createdByUserName?: string | null;
  payment?: {
    // Govt GRN
    govtGrnDate?: string;
    grnNumber?: string;
    grnAmount?: number | string;
    // DHC
    dhcDate?: string;
    dhcNumber?: string;
    dhcAmount?: number | string;
    // Commission (AC)
    commissionName?: string;
    commissionAmount?: number | string;
    commissionDate?: string;
  };
}

interface ExpenseRow {
  leadId: string;
  date: string; // raw commission date, for sorting/filtering
  leadDate: string;
  tokenNo: string;
  leadName: string;
  backWorkAccount: string;
  govtGrnDate: string;
  grnNumber: string;
  grnAmount: number;
  dhcDate: string;
  dhcNumber: string;
  dhcAmount: number;
  commissionDate: string;
  commissionName: string;
  acAmount: number; // commissionAmount
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

const leadName = (lead: ExpenseLead): string =>
  `${lead.client?.firstName || ''} ${lead.client?.lastName || ''}`.trim() || '-';

const backWorkAccountFor = (lead: ExpenseLead): string =>
  lead.assignedToUserName || lead.createdByUserName || '-';

const ROWS_PER_PAGE = 20;

// Page numbers to render in the pagination bar (0-based; -1 = ellipsis gap).
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

// Flatten leads → expense rows. One row per lead that carries ANY expense value
// (GRN, DHC or Commission — number or name). Newest commission date on top.
const buildRows = (leads: ExpenseLead[]): ExpenseRow[] => {
  const rows: ExpenseRow[] = [];
  for (const lead of leads) {
    const p = lead.payment;
    if (!p) continue;
    const grnNumber = p.grnNumber?.trim() || '';
    const grnAmount = toNum(p.grnAmount);
    const dhcNumber = p.dhcNumber?.trim() || '';
    const dhcAmount = toNum(p.dhcAmount);
    const commissionName = p.commissionName?.trim() || '';
    const acAmount = toNum(p.commissionAmount);
    // Only include leads that actually carry a GRN / DHC / Commission expense.
    const hasExpense =
      !!grnNumber || grnAmount > 0 || !!dhcNumber || dhcAmount > 0 || !!commissionName || acAmount > 0;
    if (!hasExpense) continue;
    rows.push({
      leadId: lead.id,
      date: p.commissionDate || p.govtGrnDate || p.dhcDate || '',
      leadDate: lead.leadDate || lead.createdDate || '',
      tokenNo: lead.agreement?.tokenNo || '-',
      leadName: leadName(lead),
      backWorkAccount: backWorkAccountFor(lead),
      govtGrnDate: p.govtGrnDate || '',
      grnNumber: grnNumber || '-',
      grnAmount,
      dhcDate: p.dhcDate || '',
      dhcNumber: dhcNumber || '-',
      dhcAmount,
      commissionDate: p.commissionDate || '',
      commissionName: commissionName || '-',
      acAmount,
    });
  }
  return rows.sort((a, b) => dateValue(b.date) - dateValue(a.date));
};

// ---------------------------------------------------------------------------
interface ExpensesPanelProps {
  leads: ExpenseLead[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function ExpensesPanel({ leads, loading, error, onRefresh }: ExpensesPanelProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  const allRows = useMemo(() => buildRows(leads), [leads]);
  const rows = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return allRows.filter((r) => {
      if (!from && !to) return true;
      const t = dateValue(r.date);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [allRows, fromDate, toDate]);

  const { totalGrn, totalDhc, totalAc } = useMemo(() => {
    let g = 0, d = 0, a = 0;
    for (const r of rows) { g += r.grnAmount; d += r.dhcAmount; a += r.acAmount; }
    return { totalGrn: g, totalDhc: d, totalAc: a };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  useEffect(() => { setPage(0); }, [fromDate, toDate]);
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = useMemo(
    () => rows.slice(safePage * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [rows, safePage],
  );

  const handleExport = useCallback(() => {
    const exportData = rows.map((r, i) => ({
      'Sr. No': i + 1,
      'Lead Date': formatDate(r.leadDate),
      'Token No': r.tokenNo,
      'Lead Name': r.leadName,
      'Back Work Account': r.backWorkAccount,
      'Govt GRN Date': formatDate(r.govtGrnDate),
      'GRN Number': r.grnNumber,
      'GRN Amount': r.grnAmount,
      'DHC Date': formatDate(r.dhcDate),
      'DHC Number': r.dhcNumber,
      'DHC Amount': r.dhcAmount,
      'Commission Date': formatDate(r.commissionDate),
      'Commission Name': r.commissionName,
      'AC Amount': r.acAmount,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [rows]);

  const th = 'px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm text-slate-700 whitespace-nowrap';
  const COLS = 14;

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        💸 <strong>Expenses (Govt GRN / DHC / Commission):</strong> Every lead&apos;s GRN, DHC and commission expense, newest date on top.
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
          onClick={onRefresh}
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total GRN Amount</p>
          <p className="text-lg font-semibold text-blue-600 flex items-center gap-1">
            <IndianRupee className="w-4 h-4" /> {formatINR(totalGrn)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total DHC Amount</p>
          <p className="text-lg font-semibold text-purple-600 flex items-center gap-1">
            <IndianRupee className="w-4 h-4" /> {formatINR(totalDhc)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total AC Amount</p>
          <p className="text-lg font-semibold text-amber-600 flex items-center gap-1">
            <IndianRupee className="w-4 h-4" /> {formatINR(totalAc)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Expense Entries</p>
          <p className="text-lg font-semibold text-slate-800 flex items-center gap-1">
            <TrendingDown className="w-4 h-4" /> {rows.length}
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
                <th className={th}>Token No</th>
                <th className={th}>Lead Name</th>
                <th className={th}>Back Work Account</th>
                <th className={th}>Govt GRN Date</th>
                <th className={th}>GRN Number</th>
                <th className={`${th} text-right`}>GRN Amount</th>
                <th className={th}>DHC Date</th>
                <th className={th}>DHC Number</th>
                <th className={`${th} text-right`}>DHC Amount</th>
                <th className={th}>Commission Date</th>
                <th className={th}>Commission Name</th>
                <th className={`${th} text-right`}>AC Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={COLS} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading expenses…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={COLS} className="px-4 py-10 text-center text-red-600">{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="px-4 py-10 text-center text-slate-400">No expenses found.</td>
                </tr>
              ) : (
                pagedRows.map((r, i) => (
                  <tr key={`${r.leadId}-${i}`} className="hover:bg-slate-50 transition-colors">
                    <td className={`${td} font-medium`}>{safePage * ROWS_PER_PAGE + i + 1}</td>
                    <td className={td}>{formatDate(r.leadDate)}</td>
                    <td className={`${td} font-medium`}>{r.tokenNo}</td>
                    <td className={td}>{r.leadName}</td>
                    <td className={td}>{r.backWorkAccount}</td>
                    <td className={td}>{formatDate(r.govtGrnDate)}</td>
                    <td className={td}>{r.grnNumber}</td>
                    <td className={`${td} text-right font-semibold text-blue-600`}>{formatINR(r.grnAmount)}</td>
                    <td className={td}>{formatDate(r.dhcDate)}</td>
                    <td className={td}>{r.dhcNumber}</td>
                    <td className={`${td} text-right font-semibold text-purple-600`}>{formatINR(r.dhcAmount)}</td>
                    <td className={td}>{formatDate(r.commissionDate)}</td>
                    <td className={td}>{r.commissionName}</td>
                    <td className={`${td} text-right font-semibold text-amber-600`}>{formatINR(r.acAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className={`${td} font-semibold`} colSpan={7}>Total</td>
                  <td className={`${td} text-right font-bold text-blue-600`}>{formatINR(totalGrn)}</td>
                  <td className={td} colSpan={2} />
                  <td className={`${td} text-right font-bold text-purple-600`}>{formatINR(totalDhc)}</td>
                  <td className={td} colSpan={2} />
                  <td className={`${td} text-right font-bold text-amber-600`}>{formatINR(totalAc)}</td>
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
  );
}
