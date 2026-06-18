'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/app-shell';
import Header from '@/components/header';
import { useApi } from '@/components/api-client';
import { useAuth } from '@/components/auth-provider';
import { Users, UserCheck, CreditCard, CalendarDays, Loader2, BarChart3, Send } from 'lucide-react';

interface NameCount { name: string; count: number; }
interface ReportData {
  totalLeads: number;
  perTeam: NameCount[];
  createdByPerson: NameCount[];
  forwardedByPerson: NameCount[];
  perDay: NameCount[];
  perMonth: NameCount[];
  payments: { totalReceived: number; totalPending: number; totalCommission: number; totalAgreement: number };
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const TEAM_LABELS: Record<string, string> = {
  CALLING_TEAM: 'Calling', CALLING: 'Calling',
  MARKETING_TEAM: 'Marketing', MARKETING: 'Marketing',
  EXECUTIVE_TEAM: 'Executive', EXECUTIVE: 'Executive',
  BACKEND_TEAM: 'Backend', BACKEND: 'Backend',
  ACCOUNTING: 'Accounting', ACCOUNT_TEAM: 'Accounting',
  UNASSIGNED: 'Unassigned',
};

function CountTable({ title, icon: Icon, rows, label = 'Name', unit = 'Leads', mapName }: {
  title: string; icon: React.ElementType; rows: NameCount[]; label?: string; unit?: string; mapName?: (n: string) => string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
        <Icon className="w-5 h-5 text-[#00A651]" />
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <span className="ml-auto text-xs text-slate-500">{total} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider">{label}</th>
              <th className="text-right px-5 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider w-40">{unit}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="text-center py-8 text-slate-400">No data</td></tr>
            ) : rows.map((r) => (
              <tr key={r.name} className="hover:bg-slate-50/80">
                <td className="px-5 py-2.5 text-slate-700">{mapName ? mapName(r.name) : r.name}</td>
                <td className="px-5 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <div className="hidden sm:block w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00A651] rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                    <span className="font-semibold text-slate-800 w-8 text-right">{r.count}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { apiFetch } = useApi();
  const { token, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await apiFetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load reports');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, apiFetch]);

  useEffect(() => {
    if (!authLoading && token) fetchReports();
  }, [authLoading, token, fetchReports]);

  return (
    <AppShell>
      <Header title="Reports & Analytics" />
      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#00A651]" />
          </div>
          <button onClick={fetchReports} className="px-5 py-2 bg-[#00A651] text-white rounded-lg text-sm font-medium hover:bg-[#008f44] transition-colors">Apply</button>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Clear</button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3"><Loader2 className="w-6 h-6 animate-spin" /> Loading reports...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <SummaryCard icon={BarChart3} label="Total Leads" value={data.totalLeads.toString()} color="text-[#00A651]" />
              <SummaryCard icon={CreditCard} label="Received" value={inr(data.payments.totalReceived)} color="text-emerald-600" />
              <SummaryCard icon={CreditCard} label="Pending" value={inr(data.payments.totalPending)} color="text-amber-600" />
              <SummaryCard icon={CreditCard} label="Commission" value={inr(data.payments.totalCommission)} color="text-blue-600" />
              <SummaryCard icon={CreditCard} label="Agreement Value" value={inr(data.payments.totalAgreement)} color="text-slate-700" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CountTable title="Leads per Team" icon={Users} rows={data.perTeam} label="Team" mapName={(n) => TEAM_LABELS[n] || n} />
              <CountTable title="Leads Forwarded per Person" icon={Send} rows={data.forwardedByPerson} label="User" unit="Forwarded" />
              <CountTable title="Leads Created per Person" icon={UserCheck} rows={data.createdByPerson} label="User" unit="Created" />
              <CountTable title="Leads per Month" icon={CalendarDays} rows={data.perMonth} label="Month" unit="Leads" />
            </div>

            <CountTable title="Leads per Day" icon={CalendarDays} rows={data.perDay} label="Date" unit="Leads" />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
        <Icon className={`w-4 h-4 ${color}`} /> {label}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
