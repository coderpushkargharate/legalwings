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
import {
  Download, Loader2, RefreshCw, IndianRupee, ChevronLeft, ChevronRight, TrendingDown,
  Plus, Trash2, X, Receipt, Wallet, Search,
  Banknote, Smartphone, CreditCard, FileCheck, Building2, Tag,
} from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';

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

// ---------------------------------------------------------------------------
// Manual expenses (money going OUT) — entered via the "Add Expense" form and
// stored in the `expenses` collection through /api/expenses. Kept separate from
// the lead-derived GRN/DHC/Commission rows above.
// ---------------------------------------------------------------------------
interface ManualExpense {
  id: string;
  voucherNo: string;
  title: string;
  category: string;
  amount: number;
  paidTo?: string;
  paymentMode: string;
  transactionRef?: string;
  note?: string;
  spentAt: string;
  createdByUserName?: string;
}
interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
  byCategory: { category: string; total: number; count: number }[];
}

// Kept in sync with /api/expenses.
const EXPENSE_PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash', icon: Banknote },
  { key: 'UPI', label: 'UPI', icon: Smartphone },
  { key: 'CARD', label: 'Card', icon: CreditCard },
  { key: 'CHEQUE', label: 'Cheque', icon: FileCheck },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2 },
];
const EXPENSE_CATEGORY_OPTS = [
  { key: 'OFFICE', label: 'Office' },
  { key: 'TRAVEL', label: 'Travel' },
  { key: 'SALARY', label: 'Salary' },
  { key: 'RENT', label: 'Rent' },
  { key: 'UTILITIES', label: 'Utilities' },
  { key: 'GOVT', label: 'Govt' },
  { key: 'COMMISSION', label: 'Commission' },
  { key: 'OTHER', label: 'Other' },
];
const paymentModeLabel = (key: string): string =>
  EXPENSE_PAYMENT_MODES.find((m) => m.key === key)?.label || key;
const categoryLabel = (key: string): string =>
  EXPENSE_CATEGORY_OPTS.find((c) => c.key === key)?.label || key;

// Value for a datetime-local input representing "now" in local time.
const nowLocalInput = (): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${dd}/${mm}/${yyyy} ${String(h).padStart(2, '0')}:${min} ${ampm}`;
};

// ==================== ADD EXPENSE MODAL ====================
function AddExpenseModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { apiFetch } = useApi();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OFFICE');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidTo, setPaidTo] = useState('');
  const [spentAt, setSpentAt] = useState(nowLocalInput());
  const [transactionRef, setTransactionRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setAmount(''); setCategory('OFFICE'); setPaymentMode('CASH');
      setPaidTo(''); setSpentAt(nowLocalInput()); setTransactionRef(''); setNote('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title, amount, category, paymentMode, paidTo, transactionRef, note,
          spentAt: new Date(spentAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save expense');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d] focus:border-transparent transition-all';
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#00843d]" /> Add Expense
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className={labelClass}>Expense Title</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office rent, Stamp paper" className={`${inputClass} pl-9`} required autoComplete="off" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amount (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${inputClass} pl-9`} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>Date &amp; Time</label>
              <input type="datetime-local" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {EXPENSE_CATEGORY_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          {/* Payment mode picker */}
          <div>
            <label className={labelClass}>Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_PAYMENT_MODES.map((m) => {
                const active = paymentMode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMode(m.key)}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                      active ? 'border-[#00843d] bg-[#f0fdf4] text-[#00843d] ring-1 ring-[#00843d]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <m.icon className="w-4 h-4" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelClass}>Paid To</label>
            <input type="text" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Vendor / person (optional)" className={inputClass} autoComplete="off" />
          </div>

          <div>
            <label className={labelClass}>Transaction / Reference No.</label>
            <input type="text" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UPI ref / cheque no. (optional)" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note" className={inputClass} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-[#00843d] text-white rounded-lg text-sm font-medium hover:bg-[#00622d] disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Save Expense</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== MANUAL EXPENSES SECTION ====================
// Self-contained: fetches from /api/expenses, its own search/category filters,
// add form + delete, and a summary. Sits above the lead-derived GRN/DHC table.
function ManualExpensesSection() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [expenses, setExpenses] = useState<ManualExpense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ totalAmount: 0, totalCount: 0, byCategory: [] });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchExpenses = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: '20' });
      if (searchText) params.set('searchText', searchText);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await apiFetch(`/api/expenses?${params.toString()}`);
      const data = await res.json();
      setExpenses(data?.expensePage?.content || []);
      setTotalPages(data?.expensePage?.totalPages || 1);
      setSummary(data?.summary || { totalAmount: 0, totalCount: 0, byCategory: [] });
    } catch (err) {
      console.error('Fetch expenses error:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, authLoading, user, page, searchText, categoryFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const res = await apiFetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchExpenses();
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#00843d]" /> My Expenses
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Manually added expenses (money going out).</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00843d] text-white rounded-lg text-sm font-medium hover:bg-[#00622d] transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-lg">
          <TrendingDown className="w-4 h-4 text-red-600" />
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-sm font-bold text-red-600">{formatINR(summary.totalAmount)}</span>
          <span className="text-xs text-slate-400">· {summary.totalCount} entries</span>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
            placeholder="Search title, paid to, note..."
            className="w-56 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]">
          <option value="">All Categories</option>
          {EXPENSE_CATEGORY_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Voucher</th>
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid To</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Ref / Note</th>
                <th className="px-4 py-3">Added By</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No expenses yet. Click <span className="font-medium">Add Expense</span> to add one.
                </td></tr>
              ) : expenses.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{ex.voucherNo}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(ex.spentAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{ex.title}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {categoryLabel(ex.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ex.paidTo || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{paymentModeLabel(ex.paymentMode)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatINR(ex.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[180px]">
                    <div className="truncate">{ex.transactionRef || ''}</div>
                    <div className="truncate text-xs text-slate-400">{ex.note || ''}</div>
                    {!ex.transactionRef && !ex.note && '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{ex.createdByUserName || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(ex.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
            <span className="text-slate-500">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">Previous</button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      <AddExpenseModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchExpenses} />
    </div>
  );
}

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
      {/* Manually added expenses (money going out) — own store, add form + delete. */}
      <ManualExpensesSection />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        💸 <strong>Lead Expenses (Govt GRN / DHC / Commission):</strong> Every lead&apos;s GRN, DHC and commission expense, newest date on top.
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
