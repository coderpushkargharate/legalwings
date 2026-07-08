'use client';

// ============================================================================
// 🔹 NEW PANEL: Payment Statement (date-wise)
// Pulls every recorded payment from the existing /api/leads API, flattens each
// lead's paymentDetails into one row per payment, sorts NEWEST date on top
// (oldest at the bottom), shows the Token Number, and exports to Excel.
// This is a standalone panel — it does not modify any existing code.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, Receipt, RefreshCw } from 'lucide-react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
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
}
interface Lead {
  id: string;
  client?: { firstName?: string; lastName?: string; phoneNo?: string };
  agreement?: { tokenNo?: string };
  paymentDetails?: PaymentDetail[];
}

// One flattened statement row = one payment.
interface StatementRow {
  date: string; // raw ISO/yyyy-mm-dd used for sorting
  tokenNo: string;
  leadName: string;
  phone: string;
  clientType: string;
  payerName: string;
  mode: string;
  transactionNumber: string;
  amount: number;
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

// ---------------------------------------------------------------------------
// Flatten leads → statement rows (one row per recorded payment)
// ---------------------------------------------------------------------------
const buildRows = (leads: Lead[]): StatementRow[] => {
  const rows: StatementRow[] = [];
  for (const lead of leads) {
    const tokenNo = lead.agreement?.tokenNo || '-';
    const name = leadName(lead);
    const phone = lead.client?.phoneNo || '-';
    for (const p of lead.paymentDetails || []) {
      const amount = toNum(p.paymentAmount);
      // Only include real payments (has an amount or a date).
      if (amount <= 0 && !p.paymentDate) continue;
      rows.push({
        date: p.paymentDate || '',
        tokenNo,
        leadName: name,
        phone,
        clientType: p.clientType || '-',
        payerName: p.payerName || '-',
        mode: p.modeOfPayment || '-',
        transactionNumber: p.transactionNumber || '-',
        amount,
      });
    }
  }
  // Newest date on top, oldest at the bottom.
  return rows.sort((a, b) => dateValue(b.date) - dateValue(a.date));
};

export default function PaymentStatementPage() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch ALL leads by walking through every page of the shared /api/leads API.
  const fetchAll = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const collected: Lead[] = [];
      let page = 0;
      let totalPages = 1;
      // Safety cap so a bad totalPages can never loop forever.
      do {
        const params = new URLSearchParams({
          transitLevel: 'ALL',
          viewAll: 'true',
          page: page.toString(),
          pageSize: '100',
        });
        const res = await apiFetch(`/api/leads?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load payments');
        const data = await res.json();
        collected.push(...(data?.leadPage?.content || []));
        totalPages = data?.leadPage?.totalPages || 1;
        page++;
      } while (page < totalPages && page < 100);
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

  // Excel export — same rows & order as shown on screen.
  const handleExport = useCallback(() => {
    const exportData = rows.map((r) => ({
      Date: formatDate(r.date),
      'Token Number': r.tokenNo,
      'Lead Name': r.leadName,
      Phone: r.phone,
      Type: r.clientType,
      'Payer Name': r.payerName,
      Mode: r.mode,
      'Transaction No': r.transactionNumber,
      Amount: r.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Statement');
    XLSX.writeFile(wb, `Payment_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [rows]);

  const th = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm text-slate-700 whitespace-nowrap';

  return (
    <AppShell>
      <Header title="Payment Statement" />
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          🧾 <strong>Date-wise Statement:</strong> Every recorded payment across all leads, newest date on top. Includes Token Number and downloads to Excel.
        </div>

        {/* Toolbar: date filter + actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651] focus:ring-opacity-30"
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
            onClick={fetchAll}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#00A651] hover:bg-[#008f44] rounded-lg transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" /> Download Excel
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Payments</p>
            <p className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#00A651]" /> {rows.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Amount</p>
            <p className="text-xl font-semibold text-[#00A651]">{formatINR(total)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Token Number</th>
                  <th className={th}>Lead Name</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Type</th>
                  <th className={th}>Payer Name</th>
                  <th className={th}>Mode</th>
                  <th className={th}>Transaction No</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading payments…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-red-600">{error}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">No payments found.</td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className={td}>{formatDate(r.date)}</td>
                      <td className={`${td} font-medium`}>{r.tokenNo}</td>
                      <td className={td}>{r.leadName}</td>
                      <td className={td}>{r.phone}</td>
                      <td className={td}>{r.clientType}</td>
                      <td className={td}>{r.payerName}</td>
                      <td className={td}>{r.mode}</td>
                      <td className={td}>{r.transactionNumber}</td>
                      <td className={`${td} text-right font-semibold text-[#00A651]`}>{formatINR(r.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className={`${td} font-semibold`} colSpan={8}>Total</td>
                    <td className={`${td} text-right font-bold text-[#00A651]`}>{formatINR(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
