'use client';

// ============================================================================
// 🔹 Billing Panel — record user payments / bills and keep a full history.
// Extracted from the old standalone /billing page so it can live INSIDE the
// Payment Statement page as a tab. Renders no AppShell/Header of its own.
// ============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import {
  Plus, Search, X, Trash2, Receipt, Wallet, IndianRupee,
  Loader2, User, Phone, Banknote, Smartphone, CreditCard, FileCheck, Building2,
} from 'lucide-react';

// ==================== TYPES ====================
interface Bill {
  id: string;
  billNo: string;
  clientId?: string | null;
  clientName: string;
  clientPhone?: string;
  amount: number;
  paymentMode: string;
  transactionRef?: string;
  note?: string;
  paidAt: string;
  createdByUserName?: string;
  createdAt?: string;
}
interface ClientLite {
  id: string;
  firstName?: string;
  lastName?: string;
  phoneNo?: string;
}
interface Summary {
  totalAmount: number;
  totalCount: number;
  byMode: { mode: string; total: number; count: number }[];
}

// ==================== CONSTANTS ====================
const PAYMENT_MODES = [
  { key: 'CASH', label: 'Cash', icon: Banknote, color: 'emerald' },
  { key: 'UPI', label: 'UPI', icon: Smartphone, color: 'violet' },
  { key: 'CARD', label: 'Card', icon: CreditCard, color: 'blue' },
  { key: 'CHEQUE', label: 'Cheque', icon: FileCheck, color: 'amber' },
  { key: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2, color: 'cyan' },
];

const modeMeta = (mode: string) =>
  PAYMENT_MODES.find((m) => m.key === mode) || { key: mode, label: mode, icon: Wallet, color: 'slate' };

const modeBadgeClass = (mode: string) => {
  const c = modeMeta(mode).color;
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return map[c] || map.slate;
};

// ==================== HELPERS ====================
const formatMoney = (amount?: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);

// DD/MM/YYYY hh:mm AM/PM — billing needs the exact payment time, so we show it.
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

// Value for a <input type="datetime-local"> representing "now" in local time.
const nowLocalInput = (): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// ==================== NEW BILL MODAL ====================
function NewBillModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { apiFetch } = useApi();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidAt, setPaidAt] = useState(nowLocalInput());
  const [transactionRef, setTransactionRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User search dropdown
  const [suggestions, setSuggestions] = useState<ClientLite[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientName(''); setClientPhone(''); setClientId(null); setAmount('');
      setPaymentMode('CASH'); setPaidAt(nowLocalInput()); setTransactionRef('');
      setNote(''); setError(null); setSuggestions([]); setShowSuggest(false);
    }
  }, [isOpen]);

  // Search across ALL leads (the enquiries that come in from the website), matching
  // client/owner/tenant name + phone. We map each lead's primary contact into the
  // suggestion list so the biller can pick any website lead by name.
  const searchClients = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSuggestions([]); setShowSuggest(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/leads?pageSize=8&searchText=${encodeURIComponent(q)}`);
        const data = await res.json();
        const leads = data?.leadPage?.content || [];
        setSuggestions(leads.map((l: any) => ({
          id: l.id,
          firstName: l.client?.firstName || l.agreement?.owner?.firstName || '',
          lastName: l.client?.lastName || l.agreement?.owner?.lastName || '',
          phoneNo: l.client?.phoneNo || l.agreement?.mobileNo || l.agreement?.owner?.phoneNo || '',
        })));
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [apiFetch]);

  const pickClient = (c: ClientLite) => {
    setClientName(`${c.firstName || ''} ${c.lastName || ''}`.trim());
    setClientPhone(c.phoneNo || '');
    setClientId(c.id);
    setShowSuggest(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/bills', {
        method: 'POST',
        body: JSON.stringify({
          clientId, clientName, clientPhone, amount, paymentMode,
          transactionRef, note,
          paidAt: new Date(paidAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save bill');
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
            <Receipt className="w-5 h-5 text-[#00843d]" /> New Payment / Bill
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* User select (searchable) */}
          <div className="relative">
            <label className={labelClass}>User / Customer Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => { setClientName(e.target.value); setClientId(null); searchClients(e.target.value); }}
                onFocus={() => clientName && suggestions.length > 0 && setShowSuggest(true)}
                placeholder="Search lead by name or phone, or type a name"
                className={`${inputClass} pl-9`}
                required
                autoComplete="off"
              />
            </div>
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickClient(c)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{`${c.firstName || ''} ${c.lastName || ''}`.trim() || '-'}</span>
                    <span className="text-xs text-slate-400">{c.phoneNo || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Optional" className={`${inputClass} pl-9`} autoComplete="off" />
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
              <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputClass} required />
            </div>
          </div>

          {/* Payment mode picker */}
          <div>
            <label className={labelClass}>Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((m) => {
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
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Save Payment</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== BILLING PANEL ====================
export default function BillingPanel() {
  const { apiFetch } = useApi();
  const { user, loading: authLoading } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalAmount: 0, totalCount: 0, byMode: [] });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchBills = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: '20' });
      if (searchText) params.set('searchText', searchText);
      if (modeFilter) params.set('paymentMode', modeFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await apiFetch(`/api/bills?${params.toString()}`);
      const data = await res.json();
      setBills(data?.billPage?.content || []);
      setTotalPages(data?.billPage?.totalPages || 1);
      setSummary(data?.summary || { totalAmount: 0, totalCount: 0, byMode: [] });
    } catch (err) {
      console.error('Fetch bills error:', err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, authLoading, user, page, searchText, modeFilter, fromDate, toDate]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment record?')) return;
    try {
      const res = await apiFetch(`/api/bills?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchBills();
    } catch (err) {
      console.error('Delete bill error:', err);
    }
  };

  const clearFilters = () => {
    setSearchText(''); setModeFilter(''); setFromDate(''); setToDate(''); setPage(0);
  };

  const statCards = [
    { label: 'Total Collected', value: formatMoney(summary.totalAmount), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Payments', value: String(summary.totalCount), icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Cash', value: formatMoney(summary.byMode.find((m) => m.mode === 'CASH')?.total || 0), icon: Banknote, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'UPI', value: formatMoney(summary.byMode.find((m) => m.mode === 'UPI')?.total || 0), icon: Smartphone, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Billing &amp; Payments</h2>
          <p className="text-sm text-slate-500 mt-1">Record user payments and keep a full history.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00843d] text-white rounded-lg text-sm font-medium hover:bg-[#00622d] transition-all shadow-sm">
          <Plus className="w-4 h-4" /> New Payment
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{loading ? '...' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
              placeholder="Search name, phone, bill no..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]"
            />
          </div>
          <select value={modeFilter} onChange={(e) => { setModeFilter(e.target.value); setPage(0); }} className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]">
            <option value="">All Modes</option>
            {PAYMENT_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]" />
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00843d]" />
        </div>
        {(searchText || modeFilter || fromDate || toDate) && (
          <button onClick={clearFilters} className="mt-3 text-xs text-slate-500 hover:text-[#00843d] flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Bill No.</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Ref / Note</th>
                <th className="px-4 py-3">Collected By</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No payments yet. Click <span className="font-medium">New Payment</span> to add one.
                </td></tr>
              ) : bills.map((b) => {
                const meta = modeMeta(b.paymentMode);
                return (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{b.billNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{b.clientName}</td>
                    <td className="px-4 py-3 text-slate-600">{b.clientPhone || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatMoney(b.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${modeBadgeClass(b.paymentMode)}`}>
                        <meta.icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(b.paidAt)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[180px]">
                      <div className="truncate">{b.transactionRef || ''}</div>
                      <div className="truncate text-xs text-slate-400">{b.note || ''}</div>
                      {!b.transactionRef && !b.note && '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{b.createdByUserName || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      <NewBillModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchBills} />
    </div>
  );
}
