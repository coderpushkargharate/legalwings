'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/components/api-client';
import { formatDateTime } from '@/lib/date-utils';
import Link from 'next/link';
import { Search, User, Loader2, Send, FilePlus2, UserCheck, X, Users, FileText, IndianRupee, ArrowRight } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
}

interface ForwardItem {
  leadId?: string;
  leadName?: string;
  phone?: string;
  fromTeam?: string;
  toTeam?: string;
  forwardedBy?: string;
  reason?: string;
  forwardedAt?: string;
}

interface LeadItem {
  id: string;
  leadName: string;
  phone?: string;
  transitLevel?: string;
  leadStatus?: string;
  createdAt?: string;
  assignedAt?: string;
  paymentAmount?: number | null;
  commissionAmount?: number | null;
}

interface HistoryData {
  user: { id: string; firstName: string; lastName: string; email: string; team: string; roles: string[] };
  stats: { created: number; assigned: number; forwarded: number; totalPayment: number; totalCommission: number; paidLeads: number };
  forwards: ForwardItem[];
  createdLeads: LeadItem[];
  assignedLeads: LeadItem[];
}

interface LeadMatch {
  id: string;
  leadName: string;
  phone?: string;
  leadStatus?: string;
  transitLevel?: string;
}

interface PaymentItem {
  id: string;
  totalAmount?: number | null;
  commissionAmount?: number | null;
  commissionName?: string;
  grnNumber?: string;
  dhcNumber?: string;
  description?: string;
  paymentDate?: string;
  createdAt?: string;
}

interface LeadHistoryData {
  lead: {
    id: string;
    leadName: string;
    phone?: string;
    clientType?: string;
    leadStatus?: string;
    leadSource?: string;
    transitLevel?: string;
    city?: string;
    area?: string;
    createdByUserName?: string;
    createdAt?: string;
    assignedToUserName?: string;
    assignedAt?: string;
    updatedByUserName?: string;
    updatedAt?: string;
  };
  stats: { forwarded: number; payments: number };
  forwards: ForwardItem[];
  payments: PaymentItem[];
}

type Tab = 'forwards' | 'created' | 'assigned';
type LeadTab = 'forwards' | 'payments';
type Mode = 'employee' | 'lead';

const teamLabel = (t?: string) => (t ? t.replace('_TEAM', '').replace('_', ' ') : '-');
const money = (n?: number | null) => (n == null ? '-' : `₹${Number(n).toLocaleString('en-IN')}`);

export default function AdminUserHistory() {
  const { apiFetch } = useApi();
  const [mode, setMode] = useState<Mode>('employee');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-semibold text-slate-800">User History</h3>
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Admin only</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Search an <strong>employee</strong> to view every lead they created, were assigned, or forwarded (with payments) — or search a <strong>specific lead</strong> to see its full history.
      </p>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 mb-4">
        <button
          onClick={() => setMode('employee')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'employee' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="w-4 h-4" /> Employee
        </button>
        <button
          onClick={() => setMode('lead')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'lead' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" /> Lead
        </button>
      </div>

      {mode === 'employee' ? <EmployeeHistory apiFetch={apiFetch} /> : <LeadHistory apiFetch={apiFetch} />}
    </div>
  );
}

/* ─────────────────────────── Employee history ─────────────────────────── */

function EmployeeHistory({ apiFetch }: { apiFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tab, setTab] = useState<Tab>('forwards');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/employees');
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.employees || []);
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
      }
    };
    load();
  }, [apiFetch]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search, employees]);

  const selectUser = async (emp: Employee) => {
    setSearch(`${emp.firstName} ${emp.lastName}`);
    setShowResults(false);
    setHistory(null);
    setLoadingHistory(true);
    setTab('forwards');
    try {
      const res = await apiFetch(`/api/admin/user-history?userId=${emp.id}`);
      if (res.ok) setHistory(await res.json());
      else setHistory(null);
    } catch (err) {
      console.error('Failed to load user history:', err);
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const clear = () => { setHistory(null); setSearch(''); setShowResults(false); };

  return (
    <>
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search employee by name or email..."
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {search && (
            <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showResults && matches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {matches.map(emp => (
              <button
                key={emp.id}
                onClick={() => selectUser(emp)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-slate-500 truncate">{emp.email} · {emp.team}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {showResults && search.trim() && matches.length === 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 text-sm text-slate-400">
            No matching employees.
          </div>
        )}
      </div>

      {loadingHistory && (
        <div className="flex items-center gap-2 text-slate-500 text-sm mt-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
        </div>
      )}

      {!loadingHistory && history && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{history.user.firstName} {history.user.lastName}</div>
                <div className="text-xs text-slate-500">{history.user.email} · {history.user.team}</div>
              </div>
            </div>
          </div>

          {/* Payment summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-gradient-to-br from-green-50 to-white">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Payment ({history.stats.paidLeads} leads)</div>
                <div className="text-lg font-bold text-slate-800">{money(history.stats.totalPayment)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-gradient-to-br from-purple-50 to-white">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Commission</div>
                <div className="text-lg font-bold text-slate-800">{money(history.stats.totalCommission)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatTab active={tab === 'forwards'} onClick={() => setTab('forwards')} icon={Send} label="Forwarded" value={history.stats.forwarded} color="text-amber-600" bg="bg-amber-50" />
            <StatTab active={tab === 'created'} onClick={() => setTab('created')} icon={FilePlus2} label="Created" value={history.stats.created} color="text-emerald-600" bg="bg-emerald-50" />
            <StatTab active={tab === 'assigned'} onClick={() => setTab('assigned')} icon={UserCheck} label="Assigned" value={history.stats.assigned} color="text-blue-600" bg="bg-blue-50" />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {tab === 'forwards' && (
              <HistoryTable
                empty="This user hasn't forwarded any leads."
                headers={['Lead', 'From → To', 'Reason', 'Date']}
                rows={history.forwards.map(f => ({
                  key: `${f.leadId}-${f.forwardedAt}`,
                  leadId: f.leadId,
                  cells: [
                    <LeadCell key="l" name={f.leadName} phone={f.phone} />,
                    <span key="t" className="text-slate-600">{teamLabel(f.fromTeam)} → <span className="font-medium text-slate-800">{teamLabel(f.toTeam)}</span></span>,
                    <span key="r" className="text-slate-600">{f.reason || '-'}</span>,
                    <span key="d" className="text-slate-500 whitespace-nowrap">{formatDateTime(f.forwardedAt)}</span>,
                  ],
                }))}
              />
            )}
            {tab === 'created' && (
              <HistoryTable
                empty="This user hasn't created any leads."
                headers={['Lead', 'Team', 'Status', 'Payment', 'Created']}
                rows={history.createdLeads.map(l => ({
                  key: l.id,
                  leadId: l.id,
                  cells: [
                    <LeadCell key="l" name={l.leadName} phone={l.phone} />,
                    <span key="t" className="text-slate-600">{teamLabel(l.transitLevel)}</span>,
                    <span key="s" className="text-slate-600">{l.leadStatus || '-'}</span>,
                    <span key="p" className="font-medium text-green-700">{money(l.paymentAmount)}</span>,
                    <span key="d" className="text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</span>,
                  ],
                }))}
              />
            )}
            {tab === 'assigned' && (
              <HistoryTable
                empty="No leads are currently assigned to this user."
                headers={['Lead', 'Team', 'Status', 'Payment', 'Assigned']}
                rows={history.assignedLeads.map(l => ({
                  key: l.id,
                  leadId: l.id,
                  cells: [
                    <LeadCell key="l" name={l.leadName} phone={l.phone} />,
                    <span key="t" className="text-slate-600">{teamLabel(l.transitLevel)}</span>,
                    <span key="s" className="text-slate-600">{l.leadStatus || '-'}</span>,
                    <span key="p" className="font-medium text-green-700">{money(l.paymentAmount)}</span>,
                    <span key="d" className="text-slate-500 whitespace-nowrap">{formatDateTime(l.assignedAt)}</span>,
                  ],
                }))}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────── Lead history ───────────────────────────── */

function LeadHistory({ apiFetch }: { apiFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [history, setHistory] = useState<LeadHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tab, setTab] = useState<LeadTab>('forwards');

  // Debounced server-side lead search.
  useEffect(() => {
    const q = search.trim();
    if (!q) { setMatches([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/admin/lead-history?search=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setMatches(data.leads || []);
        }
      } catch (err) {
        console.error('Lead search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, apiFetch]);

  const selectLead = async (lead: LeadMatch) => {
    setSearch(lead.leadName);
    setShowResults(false);
    setHistory(null);
    setLoadingHistory(true);
    setTab('forwards');
    try {
      const res = await apiFetch(`/api/admin/lead-history?leadId=${lead.id}`);
      if (res.ok) setHistory(await res.json());
      else setHistory(null);
    } catch (err) {
      console.error('Failed to load lead history:', err);
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const clear = () => { setHistory(null); setSearch(''); setMatches([]); setShowResults(false); };

  return (
    <>
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search lead by name, phone or token..."
            className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {searching
            ? <Loader2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
            : search && (
              <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
        </div>

        {showResults && matches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {matches.map(l => (
              <button
                key={l.id}
                onClick={() => selectLead(l)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{l.leadName || 'Unnamed lead'}</div>
                  <div className="text-xs text-slate-500 truncate">{l.phone || 'No phone'} · {teamLabel(l.transitLevel)}{l.leadStatus ? ` · ${l.leadStatus}` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {showResults && !searching && search.trim() && matches.length === 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5 text-sm text-slate-400">
            No matching leads.
          </div>
        )}
      </div>

      {loadingHistory && (
        <div className="flex items-center gap-2 text-slate-500 text-sm mt-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
        </div>
      )}

      {!loadingHistory && history && (
        <div className="mt-6">
          {/* Lead summary */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{history.lead.leadName}</div>
                <div className="text-xs text-slate-500">
                  {history.lead.phone || 'No phone'}{history.lead.clientType ? ` · ${history.lead.clientType}` : ''}{history.lead.leadSource ? ` · ${history.lead.leadSource}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">{teamLabel(history.lead.transitLevel)}</span>
              {history.lead.leadStatus && <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">{history.lead.leadStatus}</span>}
              <Link href={`/leads/new?mode=view&id=${history.lead.id}`} className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2">Open lead</Link>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MetaCard label="Created by" value={history.lead.createdByUserName || '-'} sub={formatDateTime(history.lead.createdAt)} />
            <MetaCard label="Assigned to" value={history.lead.assignedToUserName || 'Unassigned'} sub={history.lead.assignedAt ? formatDateTime(history.lead.assignedAt) : ''} />
            <MetaCard label="Last updated by" value={history.lead.updatedByUserName || '-'} sub={formatDateTime(history.lead.updatedAt)} />
            <MetaCard label="Location" value={[history.lead.area, history.lead.city].filter(Boolean).join(', ') || '-'} sub="" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatTab active={tab === 'forwards'} onClick={() => setTab('forwards')} icon={Send} label="Forwards" value={history.stats.forwarded} color="text-amber-600" bg="bg-amber-50" />
            <StatTab active={tab === 'payments'} onClick={() => setTab('payments')} icon={IndianRupee} label="Payments" value={history.stats.payments} color="text-green-600" bg="bg-green-50" />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {tab === 'forwards' && (
              history.forwards.length === 0
                ? <div className="px-4 py-8 text-center text-sm text-slate-400">This lead has never been forwarded.</div>
                : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {['Route', 'By', 'Reason', 'Date'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.forwards.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-slate-700">
                                {teamLabel(f.fromTeam)} <ArrowRight className="w-3.5 h-3.5 text-slate-400" /> <span className="font-medium text-slate-800">{teamLabel(f.toTeam)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{f.forwardedBy || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{f.reason || '-'}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(f.forwardedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}
            {tab === 'payments' && (
              history.payments.length === 0
                ? <div className="px-4 py-8 text-center text-sm text-slate-400">No payments recorded for this lead.</div>
                : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {['Total', 'Commission', 'GRN / DHC', 'Note', 'Date'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.payments.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-green-700 whitespace-nowrap">{money(p.totalAmount)}</td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{money(p.commissionAmount)}{p.commissionName ? <span className="text-xs text-slate-400"> · {p.commissionName}</span> : null}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{[p.grnNumber, p.dhcNumber].filter(Boolean).join(' / ') || '-'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.description || '-'}</td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(p.paymentDate || p.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ────────────────────────────── Shared UI ─────────────────────────────── */

function MetaCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-slate-800 truncate">{value}</div>
      {sub ? <div className="text-xs text-slate-500 truncate">{sub}</div> : null}
    </div>
  );
}

function StatTab({ active, onClick, icon: Icon, label, value, color, bg }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${active ? 'border-teal-400 bg-teal-50/50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
    >
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-lg font-bold text-slate-800">{value}</div>
      </div>
    </button>
  );
}

function LeadCell({ name, phone }: { name?: string; phone?: string }) {
  return (
    <div>
      <div className="font-medium text-slate-800">{name?.trim() || 'Unnamed lead'}</div>
      {phone && <div className="text-xs text-slate-500">{phone}</div>}
    </div>
  );
}

interface Row { key: string; leadId?: string; cells: React.ReactNode[] }
function HistoryTable({ headers, rows, empty }: { headers: string[]; rows: Row[]; empty: string }) {
  if (rows.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-slate-400">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            {headers.map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.key} className="hover:bg-slate-50 transition-colors">
              {r.cells.map((c, i) => <td key={i} className="px-4 py-3 align-top">{c}</td>)}
              <td className="px-4 py-3 text-right">
                {r.leadId && <Link href={`/leads/new?mode=view&id=${r.leadId}`} className="text-teal-600 hover:text-teal-700 text-xs font-medium">View</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
